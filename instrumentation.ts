import { validateEnvironment } from './lib/environment';

export function register(){
 if(process.env.NEXT_RUNTIME==='nodejs')validateEnvironment();
}
