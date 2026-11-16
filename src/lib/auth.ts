import {accountPreferencesKey} from './account-preferences';
import {registrationLanguage} from './mail-language';
import {languageCookie} from './language-preference';
import {languagePreferenceKey,userLanguage} from './user-language';
import { eq, inArray, like } from 'drizzle-orm';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
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
  return betterAuth({
    appName: 'AutoCare',
    baseURL: origin(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db(), { provider: 'pg', schema }),
    trustedOrigins: [origin()],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION === 'true',
      autoSignIn: process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION !== 'true',
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
      sendOnSignUp: process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION === 'true',
      autoSignInAfterVerification: false,
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
        update:{after:async user=>{await db().update(schema.supportChatMessages).set({authorName:user.name}).where(eq(schema.supportChatMessages.authorId,user.id));}},
        create: {
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
