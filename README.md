This is repo is open for collaboration, let us make it together.
---

### Queue Management System

The Queue Management System (QMS) is an application built on the Frappe framework that helps manage queues in various departments. It allows real-time updates for users as well as plays an audio file whenever a queue is called, ensuring smooth queue management and enhancing user experience. The system displays the list of queues in each day and for each department and provides a real-time update on the screen. 

#### Key Features:
- **Real-time updates** for all users across the system.
- **Queue management** for each department, displaying queues in real-time.
- **Audio notifications** that play whenever a queue is called.
- **Instant updates on screen** to show the latest changes without delay.

#### Screenshots

1. **Workspace**:
   
   ![Workspace](https://github.com/user-attachments/assets/41890417-b695-46ce-981c-0ab3bd11dd83)

2. **List of Queues in Each Department with Realtime Update**:
   
   ![List of Queues](https://github.com/user-attachments/assets/e43ace16-1d29-4cdc-808c-e257c702701b)

3. **Queue Call with Audio Attached**:
   
   ![Queue Call](https://github.com/user-attachments/assets/fa74fef6-e7ab-41e8-817b-a7a9d93183cf)

4. **Realtime Update on Screen  with additional Audio functionality**:
   
   ![image](https://github.com/user-attachments/assets/a1655df7-62dd-4dec-872a-2f8dbb3336b9)


### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/lijsamuael/qms
bench install-app qms
```

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/qms
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### Continuous Integration (CI)

This app can use GitHub Actions for CI. The following workflows are configured:

- CI: Installs this app and runs unit tests on every push to the `develop` branch.
- Linters: Runs [Frappe Semgrep Rules](https://github.com/frappe/semgrep-rules) and [pip-audit](https://pypi.org/project/pip-audit/) on every pull request.

### License

MIT
