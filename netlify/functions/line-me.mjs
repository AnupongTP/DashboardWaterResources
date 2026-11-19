import { createMeHandler } from '../lib/line-handlers.mjs';
import { runtimeDeps } from '../lib/line-runtime.mjs';

export default async (request) => createMeHandler(runtimeDeps())(request);
