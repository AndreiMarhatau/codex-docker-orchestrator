# Host Docker Socket

- Docker is enabled for this task via an isolated per-task Docker sidecar daemon.
- Docker commands can manage only resources created inside this task's sidecar daemon.
- Host Docker resources and other tasks' Docker resources are not reachable from this task.
- You may use Docker commands as needed to complete the task.
- Operate freely within this task's sidecar environment and clean up resources created during your work before finishing.
