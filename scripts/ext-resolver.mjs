// Node needs explicit file extensions in ESM; the Next.js bundler does not.
// This resolve hook lets the plain-node test scripts import the same app
// modules ("./prisma") without touching application code.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') && !specifier.endsWith('.js')) {
      return next(`${specifier}.js`, context);
    }
    throw err;
  }
}
