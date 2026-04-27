import fsSync from 'node:fs';

function materializeTaskDockerSocket(args) {
  const socketMount = args.find(
    (arg) => typeof arg === 'string' && arg.endsWith(':/var/run/orch-task-docker')
  );
  if (!socketMount) {
    return;
  }
  const socketDir = socketMount.split(':/var/run/orch-task-docker')[0];
  try {
    fsSync.mkdirSync(socketDir, { recursive: true });
    fsSync.writeFileSync(`${socketDir}/docker.sock`, '');
  } catch (error) {
    void error;
  }
}

export function handleDockerCommand({ args, dockerImageExists, dockerImageId, dockerCreatedAt }) {
  if (args[0] === 'volume' && args[1] === 'create') {
    return { stdout: `${args[2] || 'volume'}\n`, stderr: '', code: 0 };
  }
  if (args[0] === 'volume' && args[1] === 'rm') {
    return { stdout: '', stderr: '', code: 0 };
  }
  if (args[0] === 'container' && args[1] === 'inspect') {
    return { stdout: '', stderr: 'No such container', code: 1 };
  }
  if (args[0] === 'start' || args[0] === 'stop' || args[0] === 'rm') {
    return { stdout: '', stderr: '', code: 0 };
  }
  if (args[0] === '--host' && args[2] === 'info') {
    return { stdout: 'Server Version: mock\n', stderr: '', code: 0 };
  }
  if (args[0] === 'image' && args[1] === 'inspect') {
    return dockerImageExists
      ? { stdout: `${dockerImageId}|${dockerCreatedAt}`, stderr: '', code: 0 }
      : { stdout: '', stderr: 'No such image', code: 1 };
  }
  if (args[0] === 'pull') {
    return { stdout: 'pulled', stderr: '', code: 0 };
  }
  if (args[0] === 'run') {
    materializeTaskDockerSocket(args);
    return { stdout: '', stderr: '', code: 0 };
  }
  return null;
}
