// Copyright (c) 2025, Samuael Ketema and contributors
// For license information, please see license.txt

frappe.ui.form.on("Departmennt", {
	refresh(frm) {
		// Initialize queue list functionality
		if (frm.doc.name) {
			initializeQueueList(frm);
		}
	},
});

let currentForm = null;

function initializeQueueList(frm) {
	currentForm = frm;
	
	// Fetch queue list
	fetchQueueList(frm);

	// Listen for real-time queue updates
	frappe.realtime.on("queue", function(data) {
		console.log("Real-time queue update received:", data);
		
		// Only refresh if the update is for this department
		if (currentForm && data.department === currentForm.doc.name) {
			const queueTableBody = document.getElementById("queue-table-body");
			if (queueTableBody) {
				queueTableBody.innerHTML = "";
				fetchQueueList(currentForm);
			}
		}
	});

	// Listen for queue list updates
	frappe.realtime.on("queue_list", function(data) {
		console.log("Real-time queue list update received:", data);
		
		if (currentForm && data.department === currentForm.doc.name) {
			const queueTableBody = document.getElementById("queue-table-body");
			if (queueTableBody) {
				queueTableBody.innerHTML = "";
				fetchQueueList(currentForm);
			}
		}
	});
}

function fetchQueueList(frm) {
	if (!frm || !frm.doc.name) return;

	frappe.call({
		method: "qms.queue_management_system.doctype.queue.queue.get_queue_list",
		args: { department: frm.doc.name },
		callback: function(response) {
			if (response.message) {
				console.log("Queue List Response:", response.message);
				const queueTableBody = document.getElementById("queue-table-body");
				if (!queueTableBody) return;
				
				queueTableBody.innerHTML = "";

				response.message.forEach(queue => {
					const row = document.createElement("tr");
					row.setAttribute("data-ticket", queue.ticket_number);
					row.innerHTML = getQueueRowHTML(queue);
					queueTableBody.appendChild(row);
				});

				// Attach event listeners to action buttons
				attachActionListeners();
			}
		}
	});
}

// Function to generate HTML for a queue row
function getQueueRowHTML(queue) {
	return `
		<td>${queue.ticket_number || ""}</td>
		<td>${queue.department || ""}</td>
		<td>
			<span class="badge border border-secondary p-2">
				<i class="fa-solid fa-exclamation-circle"></i> ${queue.priority || ""}
			</span>
		</td>
		<td>
			<span class="badge border border-secondary p-2">
				<i class="fa-solid fa-circle"></i> ${queue.status || ""}
			</span>
		</td>
		<td>${frappe.datetime.str_to_user(queue.date) || ""}</td>
		<td>
			${getActionButtons(queue.name, queue.status)}
		</td>
	`;
}

// Generate Action Buttons Based on Status
function getActionButtons(ticketNumber, status) {
	const buttons = {
		"Waiting": [
			{ name: "call", icon: "fa-phone", color: "btn-outline-primary", label: "Call" }
		],
		"Skipped": [
			{ name: "start", icon: "fa-play", color: "btn-outline-info", label: "Start" }
		],
		"Called": [
			{ name: "skip", icon: "fa-forward", color: "btn-outline-warning", label: "Skip" },
			{ name: "start", icon: "fa-play", color: "btn-outline-info", label: "Start" }
		],
		"Being Served": [
			{ name: "complete", icon: "fa-check", color: "btn-outline-success", label: "Complete" },
			{ name: "transfer", icon: "fa-exchange-alt", color: "btn-outline-danger", label: "Transfer" }
		]
	};

	const actions = buttons[status] || [];
	return actions.map(action =>
		`<button class="btn ${action.color} btn-sm" data-action="${action.name}" data-ticket="${ticketNumber}" title="${action.label}">
			<i class="fa ${action.icon}"></i>
		</button>`
	).join(' ');
}

// Attach event listeners to action buttons
function attachActionListeners() {
	const actionButtons = document.querySelectorAll('[data-action]');
	actionButtons.forEach(button => {
		button.addEventListener('click', function() {
			const action = this.getAttribute('data-action');
			const ticketNumber = this.getAttribute('data-ticket');
			
			if (action === 'transfer') {
				openRemarkModal(ticketNumber);
			} else {
				handleAction(action, ticketNumber);
			}
		});
	});
}

// Fetch available departments from the Departmennt doctype
function fetchDepartments(callback) {
	frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: "Departmennt",
			fields: ["name"]
		},
		callback: function(response) {
			if (response.message) {
				const departmentOptions = response.message.map(dept => dept.name);
				callback(departmentOptions);
			}
		}
	});
}

// Open Frappe prompt for selecting a department as a remark
function openRemarkModal(ticketNumber) {
	fetchDepartments(function(departmentOptions) {
		frappe.prompt([
			{
				label: 'Select Department',
				fieldname: 'remark',
				fieldtype: 'Select',
				options: departmentOptions.join('\n'),
				reqd: 1
			}
		],
		function(values) {
			handleAction('transfer', ticketNumber, values.remark);
		},
		'Select Department to Transfer',
		'Submit');
	});
}

// Handle Actions
function handleAction(action, ticketNumber, remark) {
	console.log({ action, ticketNumber, remark });
	frappe.call({
		method: "qms.queue_management_system.doctype.queue.queue.handle_action",
		args: { 
			action: action, 
			ticket_number: ticketNumber, 
			remark: remark || "None" 
		},
		callback: function(response) {
			console.log("response", response);
			frappe.show_alert({
				message: __(`Action '${action}' executed successfully for Ticket #${ticketNumber}`),
				indicator: 'green'
			}, 3);
			
			// Refresh the queue list after action
			setTimeout(() => {
				if (currentForm && currentForm.doc.name) {
					fetchQueueList(currentForm);
				}
			}, 500);
		}
	});
}
