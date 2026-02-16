# Host Docker Socket

- Docker is enabled for this task via an isolated per-task Docker sidecar daemon.
- Docker commands can manage only resources created inside this task's sidecar daemon.
- Host Docker resources and other tasks' Docker resources are not reachable from this task.
- You may use Docker commands as needed to complete the task.
- Do not change, alter or remove any existing resources unless the user explicitly requests it. Before finishing, ensure no containers, images, volumes, or networks are left dangling from your work.
