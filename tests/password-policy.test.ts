import assert from 'node:assert/strict';
import { passwordRequirements,strongPasswordSchema } from '../lib/password-policy';

assert.equal(strongPasswordSchema.safeParse('MediRouteDemo123!').success,true);
assert.equal(strongPasswordSchema.safeParse('shortA1').success,false);
assert.equal(strongPasswordSchema.safeParse('lowercasepassword1').success,false);
assert.equal(strongPasswordSchema.safeParse('UPPERCASEPASSWORD1').success,false);
assert.equal(strongPasswordSchema.safeParse('NoNumberPassword').success,false);
assert.deepEqual(passwordRequirements('MediRouteDemo123!'),{length:true,lowercase:true,uppercase:true,number:true});
assert.equal(passwordRequirements('short').length,false);
console.log('Password policy tests passed.');
