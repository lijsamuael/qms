import frappe
from frappe.model.document import Document
from gtts import gTTS

class Office(Document):
    pass

@frappe.whitelist()
def call_next(department, name):
    next_ticket = frappe.get_all("Queue", filters={"department": department, "status": "Waiting"}, fields=["name", "ticket_number", "status"], order_by="creation asc", limit=1)

    if next_ticket:
        ticket = next_ticket[0]

        # Check if the ticket was already called
        if ticket.get("status") == "Called":
            return "This ticket has already been called. Use 'call_again' or 'skip'."

        # Create Queue Call
        queue_call = frappe.new_doc("Queue Call")
        queue_call.ticket_id = ticket.name
        queue_call.ticket_number = ticket.ticket_number
        queue_call.called_time = frappe.utils.now()
        queue_call.department = department
        queue_call.save()

        # Update office status
        office = frappe.get_doc("Office", name)
        office.status = "On Service"
        office.assigned_ticket = ticket.name
        office.save()

        # Update ticket status
        frappe.db.set_value("Queue", ticket.name, "status", "Called")
        frappe.db.set_value("Queue", ticket.name, "called_time", frappe.utils.now())

        # Generate audio file
        tts = gTTS(text=f"Ticket number {ticket.ticket_number} please proceed to office number {name}", lang='en')
        audio_path = f"/private/files/{ticket.ticket_number}.mp3"
        tts.save(f"{frappe.utils.get_site_path()}{audio_path}")

        # Save audio file path to Queue Call
        queue_call.audio_file = audio_path
        queue_call.is_private = 0
        queue_call.save()

        # Get assigned_office from Queue document
        assigned_office = frappe.db.get_value("Queue", ticket.name, "assigned_office")
        
        # Notify via WebSocket
        frappe.publish_realtime(
        event="queue_call",
            message={
                "ticket_number": ticket.ticket_number,
                "audio_file": queue_call.audio_file,
                "assigned_office": assigned_office,
            },
        )    
        frappe.publish_realtime(
            event="queue_list",
            message={
                "ticket_number": ticket.ticket_number,
                "assigned_office": assigned_office,
            },
        )

        return ticket.ticket_number
    else:
        return None

@frappe.whitelist()
def call_again(ticket_name):
    # Fetch the latest Queue Call entry for the given ticket
    queue_call = frappe.get_all(
        "Queue Call",
        filters={"ticket_number": ticket_name},
        fields=["name", "number_of_calls", "ticket_id"],
        order_by="creation desc",
        limit=1,
    )

    if not queue_call:
        return "No previous call record found for this ticket."

    queue_call_doc = frappe.get_doc("Queue Call", queue_call[0].name)

    # Increment the number_of_calls
    queue_call_doc.number_of_calls = (queue_call_doc.number_of_calls or 0) + 1
    queue_call_doc.save()

    # Get assigned_office from the linked Queue document
    assigned_office = None
    if queue_call_doc.ticket_id:
        assigned_office = frappe.db.get_value("Queue", queue_call_doc.ticket_id, "assigned_office")

    # Republish real-time event to notify the UI
    frappe.publish_realtime(
        event="queue_call",
        message={
            "ticket_number": ticket_name,
            "audio_file": queue_call_doc.audio_file,
            "assigned_office": assigned_office,
        },
    )

    return f"Ticket {ticket_name} has been called again {queue_call_doc.number_of_calls} times."

@frappe.whitelist()
def skip(ticket_name):
    ticket = frappe.get_doc("Queue", ticket_name)

    if ticket.status == "Skipped":
        return "This ticket is already skipped."

    # Update status to Skipped
    ticket.status = "Skipped"
    ticket.save()

    return f"Ticket {ticket.ticket_number} has been skipped."


@frappe.whitelist()
def start(ticket_name):
    ticket = frappe.get_doc("Queue", ticket_name)

    if ticket.status == "Being Served":
        return "This ticket is already being served."

    # Update status to Skipped
    ticket.status = "Being Served"
    ticket.save()

    return f"Operation on ticket {ticket.ticket_number} has been started."

@frappe.whitelist()
def complete(ticket_name, remark):
    ticket = frappe.get_doc("Queue", ticket_name)

    if ticket.status == "Completed":
        return "This ticket is already completed."

    # Update status to Completed
    ticket.status = "Completed"
    ticket.remark = remark  # Assign the remark received from frontend
    ticket.ended_at = frappe.utils.now()
    ticket.save()

    return f"Operation for {ticket.ticket_number} has been completed."

