frappe.ready(function() {
	let queueItemsMap = new Map(); // Track displayed items to prevent duplicates
	
	// Listen for queue call events
	frappe.realtime.on("queue_call", function (message) {
		console.log("Received queue call update:", message);

		if (message.ticket_number) {
			// Update and play the audio
			let ticketAudioElement = document.querySelector(".ticket_audio");
			if (ticketAudioElement && message.audio_file) {
				// Construct full URL for audio file
				let audioUrl = message.audio_file.startsWith('/') 
					? message.audio_file 
					: '/' + message.audio_file;
				ticketAudioElement.src = audioUrl;
				ticketAudioElement.load();
				ticketAudioElement.play().catch((err) => {
					console.error("Error playing audio:", err);
				});
			}
			
			// Refresh the queue list
			fetchQueueCallList();
		}
	});

	// Listen for queue list updates
	frappe.realtime.on("queue_list", function (message) {
		console.log("Received queue list update:", message);
		// Refresh the queue list
		fetchQueueCallList();
	});

	// Listen for general queue updates
	frappe.realtime.on("queue", function (message) {
		console.log("Received queue update:", message);
		// Refresh the queue list
		fetchQueueCallList();
	});

	// Fetch initial queue call list
	function fetchQueueCallList() {
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Queue Call",
				fields: ["ticket_number", "ticket_id", "audio_file", "called_time", "department", "name"],
				order_by: "creation desc",
				limit_page_length: 20,
			},
			callback: function(r) {
				console.log("Queue Call List Response:", r);

				if (r.message && r.message.length > 0) {
					let queueItemsContainer = document.getElementById("queue-items");
					let ticketAudioElement = document.querySelector(".ticket_audio");

					if (!queueItemsContainer) {
						console.error("Queue items container not found");
						return;
					}

					// Update audio if available
					let firstTicketAudio = r.message[0].audio_file;
					if (firstTicketAudio && ticketAudioElement) {
						let audioUrl = firstTicketAudio.startsWith('/') 
							? firstTicketAudio 
							: '/' + firstTicketAudio;
						if (ticketAudioElement.src !== audioUrl) {
							ticketAudioElement.src = audioUrl;
							ticketAudioElement.load();
						}
					}

					// Collect all ticket_ids to fetch assigned_office in batch
					let ticketIds = r.message
						.map(qc => qc.ticket_id)
						.filter(id => id);

					if (ticketIds.length > 0) {
						// Batch fetch assigned_office for all tickets
						frappe.call({
							method: "frappe.client.get_list",
							args: {
								doctype: "Queue",
								fields: ["name", "assigned_office"],
								filters: { name: ["in", ticketIds] }
							},
							callback: function(queueResponse) {
								// Create a map of ticket_id -> assigned_office
								let assignedOfficeMap = {};
								if (queueResponse.message) {
									queueResponse.message.forEach(queue => {
										assignedOfficeMap[queue.name] = queue.assigned_office;
									});
								}

								// Clear existing items and rebuild
								queueItemsContainer.innerHTML = "";
								queueItemsMap.clear();

								// Display all queue items with assigned_office
								r.message.forEach((queueCall) => {
									let assignedOffice = queueCall.ticket_id 
										? assignedOfficeMap[queueCall.ticket_id] 
										: null;
									displayQueueItem(queueCall, assignedOffice, false);
								});
							}
						});
					} else {
						// Clear existing items and rebuild
						queueItemsContainer.innerHTML = "";
						queueItemsMap.clear();
						
						// No ticket_ids, just display without assigned_office
						r.message.forEach((queueCall) => {
							displayQueueItem(queueCall, null, false);
						});
					}
				}
			},
		});
	}

	// Helper function to display queue item
	function displayQueueItem(queueCall, assignedOffice, isNew) {
		let queueItemsContainer = document.getElementById("queue-items");
		if (!queueItemsContainer) return;

		// Use name as unique identifier to prevent duplicates
		let itemId = queueCall.name || queueCall.ticket_number + queueCall.department;
		
		// Skip if already displayed
		if (queueItemsMap.has(itemId)) {
			return;
		}

		let queueItem = document.createElement("div");
		queueItem.classList.add("queue-item");
		queueItem.setAttribute("data-item-id", itemId);
		
		if (isNew) {
			queueItem.classList.add("new-item");
		}

		// Ticket info (left side)
		let ticketInfo = document.createElement("div");
		ticketInfo.classList.add("ticket-info");
		
		let ticketLabel = document.createElement("div");
		ticketLabel.classList.add("ticket-label");
		ticketLabel.textContent = "Ticket:";
		ticketInfo.appendChild(ticketLabel);
		
		let ticketValue = document.createElement("div");
		ticketValue.classList.add("ticket-value");
		ticketValue.textContent = queueCall.ticket_number || "N/A";
		ticketInfo.appendChild(ticketValue);
		
		queueItem.appendChild(ticketInfo);

		// Department info (right side)
		let departmentInfo = document.createElement("div");
		departmentInfo.classList.add("department-info");
		
		let departmentLabel = document.createElement("div");
		departmentLabel.classList.add("department-label");
		departmentLabel.textContent = "Department:";
		departmentInfo.appendChild(departmentLabel);
		
		let departmentValue = document.createElement("div");
		departmentValue.classList.add("department-value");
		departmentValue.textContent = queueCall.department || "N/A";
		departmentInfo.appendChild(departmentValue);
		
		queueItem.appendChild(departmentInfo);

		// Add the new queue item to the list
		queueItemsContainer.appendChild(queueItem);
		
		// Mark as displayed
		queueItemsMap.set(itemId, true);
	}

	// Initial load
	fetchQueueCallList();
	
	// Refresh every 30 seconds to keep data fresh
	setInterval(function() {
		fetchQueueCallList();
	}, 30000);
});
