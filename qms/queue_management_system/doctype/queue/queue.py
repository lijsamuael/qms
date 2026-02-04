# Copyright (c) 2025, Samuael Ketema and contributors
# For license information, please see license.txt

import frappe
from datetime import datetime
from frappe.model.document import Document
from gtts import gTTS



class Queue(Document):
    def before_insert(self):
        # Set the ticket number
        self.set_ticket_number()
        frappe.publish_realtime(
            event="queue",
            message={
                "name": self.name,
                "ticket_number": self.ticket_number,
                "department": self.department,
                "priority": self.priority,
                "status": self.status,
                "date": self.date,
        },
    )

    def on_update(self):
        frappe.publish_realtime(
            event="queue",
            message={
                "name": self.name,
                "ticket_number": self.ticket_number,
                "department": self.department,
                "priority": self.priority,
                "status": self.status,
                "date": self.date,
        },
    )

    def set_ticket_number(self):
        # Get today's date in YYYY-MM-DD format
        today = datetime.now().strftime("%Y-%m-%d")

        # Get the last ticket number for the service on the current day
        last_ticket = frappe.db.get_value(
            "Queue", 
            {
                "department": self.department,
                "date": today 
            }, 
            "ticket_number", 
            order_by="creation desc"
        )

        # If there is no last ticket for today, start from 001
        if not last_ticket:
            self.ticket_number = f"001"
        else:
            # Extract the last number, increment it, and format it as a 3-digit number
            last_number = int(last_ticket.split('-')[-1]) + 1
            self.ticket_number = f"{last_number:03}"



import frappe
from frappe.utils import today

@frappe.whitelist()
def get_queue_list(department):
    """Fetch the list of queues from the database."""
    queues = frappe.get_all(
        "Queue",
        fields=["*"],
        filters={
            "department": department,
            "status": ["!=", "Completed"],
            "date": today()
        },
        order_by="FIELD(status, 'Being Served', 'Called', 'Waiting', 'Skipped'), date DESC"
    )
    return queues



@frappe.whitelist()
def handle_action(action, ticket_number, remark):
    #Get Ticket info
    ticket = frappe.get_doc("Queue", ticket_number)
    if action == "call":
        return call(ticket.department, ticket_number)
    elif action == "skip":
        return skip(ticket_number)
    elif action == "start":
        return start(ticket_number)
    elif action == "complete":
        return complete(ticket_number, remark)
    elif action == "transfer":
        return transfer(ticket_number, remark)

@frappe.whitelist()
def call(department, name):

    #Get department info
    dpt = frappe.get_doc("Departmennt", department)
    ticket = frappe.get_doc("Queue", name)

    # Create Queue Call
    queue_call = frappe.new_doc("Queue Call")
    queue_call.ticket_id = name
    queue_call.ticket_number = ticket.ticket_number
    queue_call.called_time = frappe.utils.now()
    queue_call.department = department
    queue_call.save()

    # Update ticket status
    frappe.db.set_value("Queue", name, "status", "Called")
    frappe.db.set_value("Queue", name, "called_time", frappe.utils.now())



    # Generate audio file
    tts = gTTS(text=f"Ticket number {ticket.ticket_number} please proceed to office number {dpt.office_number}", lang='en')
    audio_path = f"/private/files/{ticket.ticket_number}.mp3"
    tts.save(f"{frappe.utils.get_site_path()}{audio_path}")

    # Save audio file path to Queue Call
    queue_call.audio_file = audio_path
    queue_call.is_private = 0
    queue_call.save()

    # Notify via WebSocket
    frappe.publish_realtime(
        event="queue",
        message={
            "name": ticket.name,
            "ticket_number": ticket.ticket_number,
            "department": ticket.department,
            "priority": ticket.priority,
            "status": ticket.status,
            "date": ticket.date,
    },
    )

    frappe.publish_realtime(
    event="queue_call",
        message={
            "ticket_number": ticket.ticket_number,
            "audio_file": queue_call.audio_file,
            "department": ticket.department,
        },
    )    
    frappe.publish_realtime(
        event="queue_list",
        message={
            "ticket_number": ticket.ticket_number,
            "department": ticket.department,
        },
    )



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
def skip(ticket_number):
    ticket = frappe.get_doc("Queue", ticket_number)

    # Update status to Skipped
    ticket.status = "Skipped"
    ticket.save()


    frappe.publish_realtime(
        event="queue",
        message={
            "name": ticket.name,
            "ticket_number": ticket.ticket_number,
            "department": ticket.department,
            "priority": ticket.priority,
            "status": ticket.status,
            "date": ticket.date,
    },
    )





@frappe.whitelist()
def start(ticket_number):
    ticket = frappe.get_doc("Queue", ticket_number)

    # Update status to Skipped
    ticket.status = "Being Served"
    ticket.save()

    frappe.publish_realtime(
        event="queue",
        message={
            "name": ticket.name,
            "ticket_number": ticket.ticket_number,
            "department": ticket.department,
            "priority": ticket.priority,
            "status": ticket.status,
            "date": ticket.date,
    },
    )


@frappe.whitelist()
def complete(ticket_name, remark):
    ticket = frappe.get_doc("Queue", ticket_name)



    # Update status to Completed
    ticket.status = "Completed"
    ticket.remark = remark  # Assign the remark received from frontend
    ticket.completed_at = frappe.utils.now()
    ticket.save()

    frappe.publish_realtime(
        event="queue",
        message={
            "name": ticket.name,
            "ticket_number": ticket.ticket_number,
            "department": ticket.department,
            "priority": ticket.priority,
            "status": ticket.status,
            "date": ticket.date,
    },
    )


@frappe.whitelist()
def transfer(ticket_number, remark):
    ticket = frappe.get_doc("Queue", ticket_number)

    # Update the department to Transferred
    ticket.department = remark
    ticket.save()


    frappe.publish_realtime(
        event="queue",
        message={
            "name": ticket.name,
            "ticket_number": ticket.ticket_number,
            "department": ticket.department,
            "priority": ticket.priority,
            "status": ticket.status,
            "date": ticket.date,
    },
    )
    return ticket