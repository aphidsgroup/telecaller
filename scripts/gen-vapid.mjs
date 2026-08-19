// Generates the VAPID key pair needed for Web Push. Paste the output into .env.
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('VAPID_PUBLIC_KEY="%s"', keys.publicKey);
console.log('VAPID_PRIVATE_KEY="%s"', keys.privateKey);
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY="%s"', keys.publicKey);
console.log('VAPID_SUBJECT="mailto:admin@yourcompany.com"');
