import { MessageChannel } from 'node:worker_threads';

console.log('apps/worker started');

const { port1, port2 } = new MessageChannel();
port1.ref();

function shutdown(): void {
  port1.close();
  port2.close();
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
