import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { mintPass } from './functions/mintPass/resource.js';
import { attestPass } from './functions/attestPass/resource.js';

defineBackend({
  auth,
  data,
  mintPass,
  attestPass,
});
