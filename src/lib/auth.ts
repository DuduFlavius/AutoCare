import {accountPreferencesKey} from './account-preferences';
import {registrationLanguage} from './mail-language';
import {languageCookie} from './language-preference';
import {languagePreferenceKey,userLanguage} from './user-language';
import { eq, inArray, like, sql, or } from 'drizzle-orm';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { emailOTP } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { toNextJsHandler } from 'better-auth/next-js';
import { db } from './db';
import * as schema from './schema';
import { sendMail } from './mail';
import { renderEmail } from './email-templates';
import { queueAutomatedMail } from './mail-automation';
import { origin } from './config';
import { financeBudgetKey } from './finance-overview';
import { primaryVehicleKey } from './garage-overview';
import { createHash } from 'node:crypto';
let cached: ReturnType<typeof makeAuth> | undefined;
function makeAuth() {
  if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32)
    throw new Error('BETTER_AUTH_SECRET trebuie să aibă minimum 32 caractere.');
  const requireVerification=process.env.NODE_ENV==='production'||process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION!=='false';
  return betterAuth({
    appName: 'AutoCare',
    baseURL: origin(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db(), { provider: 'pg', schema }),
    trustedOrigins: [origin()],
    hooks:{before:createAuthMiddleware(async ctx=>{
      if(ctx.body&&typeof ctx.body.email==='string')ctx.body.email=ctx.body.email.trim().toLowerCase();
      if(ctx.body&&typeof ctx.body.newEmail==='string')ctx.body.newEmail=ctx.body.newEmail.trim().toLowerCase();
      if(['/email-otp/send-verification-otp','/email-otp/verify-email'].includes(ctx.path)&&typeof ctx.body?.email==='string'){
        const person=(await db().select().from(schema.user).where(eq(schema.user.email,ctx.body.email)))[0];
        if(person?.emailVerified)throw new APIError('BAD_REQUEST',{code:'EMAIL_ALREADY_VERIFIED',message:'Adresa este deja verificată. Autentifică-te cu parola.'});
      }
      if(ctx.path==='/sign-up/email'||ctx.path==='/change-email'){
        const email=ctx.path==='/sign-up/email'?ctx.body?.email:ctx.body?.newEmail;
        if(typeof email==='string'&&(await db().select({id:schema.user.id}).from(schema.user).where(sql`lower(btrim(${schema.user.email}))=${email}`)).length)
          throw new APIError('CONFLICT',{code:'USER_ALREADY_EXISTS',message:'Există deja un cont cu această adresă. Intră în cont sau recuperează parola.'});
      }
    })},
    plugins:[emailOTP({otpLength:6,expiresIn:600,allowedAttempts:5,storeOTP:'hashed',disableSignUp:true,
      sendVerificationOnSignUp:requireVerification,
      async sendVerificationOTP({email,otp,type},ctx){
        if(type!=='email-verification')throw new APIError('BAD_REQUEST',{message:'Folosește autentificarea cu parolă.'});
        const person=(await db().select().from(schema.user).where(eq(schema.user.email,email)))[0];
        const language=languageCookie(ctx?.headers?.get('cookie'))??(person?await userLanguage(person.id):'ro'),en=language==='en';
        const content=renderEmail('verification',{name:person?.name,language,subject:en?'Your AutoCare verification code':'Codul tău de verificare AutoCare',message:en?`Your verification code is: ${otp}\n\nEnter it in AutoCare to confirm your email. It expires in 10 minutes. Never share this code. If you did not request it, ignore this email.`:`Codul tău de verificare este: ${otp}\n\nIntrodu-l în AutoCare pentru a confirma adresa de email. Expiră în 10 minute. Nu comunica acest cod altor persoane. Dacă nu l-ai solicitat, ignoră mesajul.`,actionUrl:origin()+(en?'/en/sign-in':'/autentificare'),ctaLabel:en?'Open AutoCare':'Deschide AutoCare'});
        content.html=content.html.replaceAll(otp,`<strong style="display:block;font-size:32px;letter-spacing:8px;color:#6952bd;padding:18px 0">${otp}</strong>`);
        await sendMail(email,content.subject,content.text,crypto.randomUUID(),content,person?{userId:person.id,template:'verification'}:undefined);
      },rateLimit:{window:60,max:3}})],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: requireVerification,
      autoSignIn: !requireVerification,
      minPasswordLength: 12,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url },request) => {
        await sendMail(
          user.email,
          'Resetează parola AutoCare',
          url,
          createHash('sha256').update(url).digest('hex'),
          renderEmail('password_reset', { name: user.name, actionUrl: url, language:languageCookie(request?.headers.get('cookie'))??await userLanguage(user.id) }),
          { userId: user.id, template: 'password_reset' },
        );
      },
    },
    emailVerification: {
      sendOnSignUp: false,
      sendOnSignIn:false,
      autoSignInAfterVerification: true,
      afterEmailVerification:async(user)=>{
        const key='security-email-change:'+user.id+':'+createHash('sha256').update(user.email).digest('hex');
        const row=(await db().select().from(schema.settings).where(eq(schema.settings.key,key)))[0];
        const previous=row?.value as {oldEmail?:string;newEmail?:string}|undefined;
        if(previous?.oldEmail&&previous.newEmail===user.email){
          const language=await userLanguage(user.id);
          const content=renderEmail('administrative',{name:user.name,language,subject:language==='en'?'Your AutoCare email address changed':'Adresa de email AutoCare a fost schimbată',message:language==='en'?'The email address on your account was changed after verification. If you did not authorize this change, contact AutoCare support immediately.':'Adresa de email a contului a fost schimbată după verificare. Dacă nu ai autorizat schimbarea, contactează imediat suportul AutoCare.'});
          try{await sendMail(previous.oldEmail,content.subject,content.text,'email-change:'+user.id+':'+createHash('sha256').update(user.email).digest('hex'),content,{userId:user.id,template:'administrative'});await db().delete(schema.settings).where(eq(schema.settings.key,key));}catch{console.error(JSON.stringify({event:'account_security_notice_failed'}));}
        }
      },
      sendVerificationEmail: async ({ user, url },request) => {
        const previous=(await db().select().from(schema.user).where(eq(schema.user.id,user.id)))[0];
        if(previous&&previous.email!==user.email){
          const key='security-email-change:'+user.id+':'+createHash('sha256').update(user.email).digest('hex'),value={oldEmail:previous.email,newEmail:user.email};
          await db().insert(schema.settings).values({key,value}).onConflictDoUpdate({target:schema.settings.key,set:{value}});
        }
        await sendMail(
          user.email,
          'Confirmă adresa de email AutoCare',
          url,
          createHash('sha256').update(url).digest('hex'),
          renderEmail('verification', { name: user.name, actionUrl: url, language:languageCookie(request?.headers.get('cookie'))??await userLanguage(user.id) }),
          { userId: user.id, template: 'verification' },
        );
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    user: {
      changeEmail:{
        enabled:true,updateEmailWithoutVerification:false,
        sendChangeEmailConfirmation:async({user,url})=>{
          const language=await userLanguage(user.id);
          const content=renderEmail('verification',{name:user.name,language,actionUrl:url,subject:language==='en'?'Confirm your email change':'Confirmă schimbarea adresei de email',message:language==='en'?'Confirm that you requested this email change. A second confirmation will be sent to your new address. If you did not request it, ignore this email and secure your account.':'Confirmă că ai solicitat schimbarea adresei. Vei primi apoi o verificare la adresa nouă. Dacă nu ai făcut solicitarea, ignoră mesajul și securizează contul.'});
          await sendMail(user.email,content.subject,content.text,createHash('sha256').update(url).digest('hex'),content,{userId:user.id,template:'verification'});
        },
      },
      deleteUser: {
        enabled: true,
        deleteTokenExpiresIn:1800,
        sendDeleteAccountVerification:async({user,url})=>{
          const language=await userLanguage(user.id);
          const content=renderEmail('administrative',{name:user.name,language,actionUrl:url,subject:language==='en'?'Confirm permanent AutoCare account deletion':'Confirmă ștergerea definitivă a contului AutoCare',message:language==='en'?'You requested permanent deletion of your account and its stored vehicle data. This link is the final confirmation and expires in 30 minutes. Any active Stripe subscription will be canceled before deletion. Google Play subscriptions must be canceled separately in Google Play. If you did not request deletion, do not open the confirmation link.':'Ai solicitat ștergerea definitivă a contului și a datelor auto salvate. Acest link reprezintă confirmarea finală și expiră în 30 de minute. Abonamentul Stripe activ va fi anulat înainte de ștergere. Abonamentele Google Play trebuie anulate separat în Google Play. Dacă nu ai făcut solicitarea, nu deschide linkul de confirmare.',ctaLabel:language==='en'?'Confirm permanent deletion':'Confirmă ștergerea definitivă'});
          await sendMail(user.email,content.subject,content.text,createHash('sha256').update(url).digest('hex'),content,{userId:user.id,template:'administrative'});
        },
        afterDelete: async u => {
          await db().delete(schema.settings).where(like(schema.settings.key,'security-email-change:'+u.id+':%'));
          await db().delete(schema.settings).where(inArray(schema.settings.key, [primaryVehicleKey(u.id), financeBudgetKey(u.id), languagePreferenceKey(u.id),accountPreferencesKey(u.id),'security-email-change:'+u.id]));
        },
        beforeDelete: async (u) => {
          await db().delete(schema.verification).where(or(eq(schema.verification.value,u.id),inArray(schema.verification.identifier,['email-verification','sign-in','forget-password'].map(type=>type+'-otp-'+u.email.toLowerCase()))));
          const sub = (
            await db()
              .select()
              .from(schema.subscriptions)
              .where(eq(schema.subscriptions.userId, u.id))
          )[0];
          if(sub?.subscriptionId&&['active','past_due','trialing','unpaid','incomplete'].includes(sub.status)){
            const {stripe}=await import('./billing');
            await stripe().subscriptions.cancel(sub.subscriptionId);
            await db().update(schema.subscriptions).set({status:'canceled',cancelAtPeriodEnd:true,updatedAt:new Date()}).where(eq(schema.subscriptions.userId,u.id));
          }
        },
      },
    },
    databaseHooks: {
      account:{update:{after:async account=>{
        if(account.providerId!=='credential'||!account.password)return;
        const user=(await db().select().from(schema.user).where(eq(schema.user.id,account.userId)))[0];
        if(!user)return;
        const language=await userLanguage(user.id);
        const content=renderEmail('account_security',{name:user.name,language,subject:language==='en'?'Your AutoCare password was changed':'Parola AutoCare a fost schimbată',message:language==='en'?'The password for your AutoCare account was updated. If you did not make this change, reset your password and contact support immediately.':'Parola contului tău AutoCare a fost actualizată. Dacă nu ai făcut schimbarea, resetează parola și contactează imediat suportul.'});
        try{await sendMail(user.email,content.subject,content.text,'password-change:'+createHash('sha256').update(account.password).digest('hex'),content,{userId:user.id,template:'account_security'});}catch{console.error(JSON.stringify({event:'password_security_notice_failed'}));}
      }}},
      session: {
        create: {
          before: async (session) => {
            const row = (
              await db()
                .select()
                .from(schema.accountRestrictions)
                .where(eq(schema.accountRestrictions.userId, session.userId))
            )[0];
            if (row?.suspendedAt)
              throw new APIError('FORBIDDEN', {
                message: 'Contul este suspendat. Contactează echipa AutoCare.',
              });
            return { data: session };
          },
        },
      },
      user: {
        update:{before:async (user)=>{if(user.email){const email=user.email.trim().toLowerCase();return {data:{...user,email}};}return {data:user};},after:async user=>{await db().update(schema.supportChatMessages).set({authorName:user.name}).where(eq(schema.supportChatMessages.authorId,user.id));}},
        create: {
          before:async user=>({data:{...user,email:user.email.trim().toLowerCase()}}),
          after: async (u,ctx) => {
            const language=languageCookie(ctx?.headers?.get('cookie'))??registrationLanguage(ctx?.headers?.get('accept-language'));
            if(language) await db().insert(schema.settings).values({key:languagePreferenceKey(u.id),value:{language}}).onConflictDoUpdate({target:schema.settings.key,set:{value:{language}}});
            try {
              await queueAutomatedMail(u.id, 'welcome', `welcome:${u.id}`);
            } catch {
              console.error(JSON.stringify({ event: 'welcome_queue_failed' }));
            }
          },
        },
        delete: {
          before: async (u) => {
            const ids = (
              await db()
                .select({ id: schema.notifications.providerId })
                .from(schema.notifications)
                .where(eq(schema.notifications.userId, u.id))
            )
              .map((r) => r.id)
              .filter((id): id is string => !!id);
            if (ids.length)
              await db()
                .delete(schema.emailEvents)
                .where(inArray(schema.emailEvents.providerId, ids));
          },
        },
      },
    },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 30 },
    advanced: {
      ipAddress: {
        ipAddressHeaders: process.env.VERCEL ? ['x-vercel-forwarded-for'] : ['x-real-ip'],
      },
      useSecureCookies: origin().startsWith('https://'),
    },
  });
}
export function auth() {
  return (cached ??= makeAuth());
}
export function authHandlers() {
  return toNextJsHandler(auth());
}
