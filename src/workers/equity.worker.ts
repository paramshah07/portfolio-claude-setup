// The equity readout's worker, so counting every runout never blocks the page.
//
// The page posts { id, hole, board } for equity against one random hand, adding opponent for one
// known hand, and gets back { id, result } or { id, error }. A job runs in slices with a pause
// after each one. If a newer job has arrived by then, the old one stops and never answers. The
// page should still ignore any answer whose id isn't the latest it sent.

import { equityJob, headsUpJob, type EquityResult } from '../lib/poker/api.ts';

export interface EquityRequest {
  id: number;
  hole: string[];
  board: string[];
  opponent?: string[];
}

export type EquityResponse = { id: number; result: EquityResult } | { id: number; error: string };

let latest = 0;

// A pause that lets waiting messages in. A MessageChannel answers on the next task, where
// setTimeout(0) would be clamped to 4 ms once nested.
const channel = new MessageChannel();
const waiting: (() => void)[] = [];
channel.port1.onmessage = () => waiting.shift()?.();
const pause = () =>
  new Promise<void>((resolve) => {
    waiting.push(resolve);
    channel.port2.postMessage(null);
  });

self.onmessage = async ({ data }: MessageEvent<EquityRequest>) => {
  latest = data.id;
  const reply = (response: EquityResponse) => self.postMessage(response);
  try {
    const job = data.opponent ? headsUpJob(data.hole, data.opponent, data.board) : equityJob(data.hole, data.board);
    let step = job.next();
    while (!step.done) {
      await pause();
      if (data.id !== latest) return;
      step = job.next();
    }
    reply({ id: data.id, result: step.value });
  } catch (error) {
    reply({ id: data.id, error: error instanceof Error ? error.message : String(error) });
  }
};
