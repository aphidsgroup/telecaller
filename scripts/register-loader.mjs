import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ext-resolver.mjs', pathToFileURL(`${import.meta.dirname}/`));
