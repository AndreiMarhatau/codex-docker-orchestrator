export function emitUsageLimit(child) {
  child.stdout.write(
    JSON.stringify({ type: 'thread.started', thread_id: 'thread-1' }) +
      '\n' +
      JSON.stringify({ type: 'error', message: "You've hit your usage limit." }) +
      '\n'
  );
  child.stdout.end();
  child.emit('close', 1, null);
}

export function emitSuccess(child, isResume) {
  child.stdout.write(
    JSON.stringify({ type: 'thread.started', thread_id: 'thread-1' }) +
      '\n' +
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'item_1', type: 'agent_message', text: isResume ? 'RESUME' : 'OK' }
      }) +
      '\n'
  );
  child.stdout.end();
  child.emit('close', 0, null);
}
