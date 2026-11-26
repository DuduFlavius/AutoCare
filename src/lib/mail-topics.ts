const topics = [
  ['account','Cont și acces','Account & access','welcome verification password_reset account_security onboarding_guide notification_help'],
  ['garage','Garaj și kilometraj','Garage & mileage','first_vehicle vehicle_added mileage_check'],
  ['documents','Documente și expirări','Documents & deadlines','rca casco itp vignette registration_card road_assistance document_update reminder'],
  ['service','Revizii și întreținere','Service & maintenance','oil_change service_due tires winter_storage auto_tips service_folder'],
  ['billing','Premium și plăți','Premium & billing','premium_grant premium_expiry payment_receipt payment_failed renewal invoice_help subscription_cancelled special_offer'],
  ['support','Asistență și feedback','Support & feedback','support_received support_reply support_details support_resolved feedback feedback_received'],
  ['releases','Actualizări AutoCare','AutoCare updates','app_update android_update update_failed release_news feature_news newsletter_editorial'],
  ['navigation','Navigație și conectivitate','Navigation & connectivity','gps_review gps_setup gps_sync bluetooth_help map_help permissions_help offline_help'],
  ['reports','Rapoarte și cheltuieli','Reports & expenses','expense_review statement_ready export_help monthly_report'],
  ['operations','Incidente și mentenanță','Incidents & operations','incident_open incident_progress incident_resolved planned_outage maintenance_notice'],
  ['general','Comunicare generală','General communication','administrative promotional data_request gmail_test'],
] as const;
export const mailTopics=topics.map(([id,ro,en])=>({id,ro,en}));
const index=new Map(topics.flatMap(([id,,,templates])=>templates.split(' ').map(template=>[template,id] as const)));
export function mailTopic(template:string){return index.get(template)??'general';}
