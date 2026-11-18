export function validateEnvironment(env:Record<string,string|undefined>=process.env):void{
 const problems:string[]=[];
 if(!env.AUTH_SECRET||env.AUTH_SECRET.length<32)problems.push('AUTH_SECRET must be set to at least 32 characters.');
 if(env.MYSQL_PORT!==undefined){const port=Number(env.MYSQL_PORT);if(!Number.isInteger(port)||port<1||port>65535)problems.push('MYSQL_PORT must be an integer from 1 to 65535.');}
 for(const key of ['QDRANT_URL','APP_URL'] as const){
  const value=env[key];if(!value)continue;
  try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol))throw new Error('unsupported protocol');}
  catch{problems.push(`${key} must be a valid HTTP or HTTPS URL.`);}
 }
 if(problems.length)throw new Error(`Invalid MediRoute environment configuration: ${problems.join(' ')}`);
}
