import assert from 'node:assert/strict';
import { validateEnvironment } from '../lib/environment';

const valid={AUTH_SECRET:'a-local-test-secret-that-is-at-least-thirty-two-chars',MYSQL_PORT:'3306',QDRANT_URL:'http://localhost:6333',APP_URL:'http://localhost:3000'};
assert.doesNotThrow(()=>validateEnvironment(valid));
assert.throws(()=>validateEnvironment({...valid,AUTH_SECRET:'short'}),/AUTH_SECRET/);
assert.throws(()=>validateEnvironment({...valid,MYSQL_PORT:'3306abc'}),/MYSQL_PORT/);
assert.throws(()=>validateEnvironment({...valid,QDRANT_URL:'file:/secret'}),/QDRANT_URL/);
console.log('Environment configuration checks passed.');
