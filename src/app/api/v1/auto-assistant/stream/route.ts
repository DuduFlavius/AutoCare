import { POST as dispatch } from '../../[...path]/route';

export const maxDuration = 60;
export const runtime = 'nodejs';

export function POST(request: Request) {
  return dispatch(request, { params: Promise.resolve({ path: ['auto-assistant'] }) });
}
