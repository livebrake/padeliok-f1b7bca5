/** Bound nonessential background work without swallowing failures or leaving timers alive. */
export async function withRequestTimeout<T>(request: PromiseLike<T>, milliseconds = 8000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Užklausa užtruko per ilgai. Bandykite dar kartą.')), milliseconds); }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}