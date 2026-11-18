export const feedbackCopy={
 category:{suggestion:['Sugestie','Suggestion'],problem:['Raportare problemă','Report a problem'],experience:['Experiența mea','My experience']},
 status:{new:['Nou','New'],review:['În analiză','Under review'],progress:['În lucru','In progress'],resolved:['Rezolvat','Resolved'],closed:['Închis','Closed']},
 priority:{normal:['Normală','Normal'],high:['Ridicată','High'],critical:['Critică','Critical']},
 area:{general:['General','General'],documents:['Documente','Documents'],gps:['GPS și trasee','GPS & trips'],expenses:['Cheltuieli','Expenses'],account:['Cont','Account'],support:['Suport','Support'],ai:['AutoCare AI','AutoCare AI']},
 error:{
 FEEDBACK_SIGN_IN:['Sesiunea a expirat. Reconectează-te; mesajul din formular rămâne aici.','Your session expired. Sign in again; your message remains in this form.'],
 FEEDBACK_NOT_FOUND:['Feedbackul nu există sau nu ai acces.','This feedback is unavailable or you do not have access.'],
 FEEDBACK_ADMIN_ONLY:['Această secțiune este rezervată administratorilor.','This section is for administrators only.'],
 FEEDBACK_FILE_SIZE:['Fiecare captură trebuie să aibă cel mult 2 MB, inclusiv după procesare.','Each screenshot must be up to 2 MB, including after processing.'],
 FEEDBACK_FILE_TYPE:['Alege o imagine PNG, JPEG sau WebP validă, fără animație.','Choose a valid, non-animated PNG, JPEG or WebP image.'],
 FEEDBACK_FILE_COUNT:['Poți atașa cel mult două capturi.','You can attach up to two screenshots.'],
 FEEDBACK_DUPLICATE:['Acest feedback a fost deja trimis. Îl găsești în lista ta.','This feedback was already sent. You can find it in your list.'],
 FEEDBACK_RATE_LIMIT:['Ai trimis prea multe mesaje. Așteaptă puțin; limita este de 5 feedbackuri pe zi.','You have sent too many messages. Please wait; the limit is 5 feedback submissions per day.'],
 FEEDBACK_CHANGED:['Feedbackul a fost actualizat între timp. Reîncarcă înainte să salvezi.','This feedback has changed. Reload it before saving.'],
 FEEDBACK_CLOSED:['Feedbackul este închis. Poți trimite o solicitare nouă.','This feedback is closed. You can send a new submission.'],
 },
} as const;
