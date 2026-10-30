'use client';
import { useState } from 'react';
import { parseServiceDetails } from '@/lib/service-details';
import { useApplicationLanguage } from './application-locale';
export default function OperationAlerts({ parts, premium }: { parts: string; premium: boolean }) {
  const en = useApplicationLanguage() === 'en',
    saved = parseServiceDetails(parts),
    [custom, setCustom] = useState(saved.alertDays !== undefined || !!saved.alertKm),
    [days, setDays] = useState((saved.alertDays || '30,14,7,3,1,0').split(',').map(Number));
  if (!premium)
    return (
      <p className="micro" data-workspace-ui>
        {en
          ? 'Premium adds separate reminders for each operation. Your existing general reminders remain available.'
          : 'Premium adaugă alerte separate pentru fiecare operațiune. Mementourile generale existente rămân disponibile.'}
      </p>
    );
  return (
    <fieldset className="ac-operation-alerts" data-workspace-ui>
      <legend>{en ? 'Reminders for this operation' : 'Alerte pentru această operațiune'}</legend>
      <label className="check">
        <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />
        {en ? 'Use separate preferences' : 'Folosește preferințe separate'}
      </label>
      {custom && (
        <>
          <input type="hidden" name="ac_alertDays" value={days.length ? days.join(',') : 'none'} />
          <div className="ac-alert-offsets">
            {[30, 14, 7, 3, 1, 0].map((day) => (
              <label className="check" key={day}>
                <input
                  type="checkbox"
                  checked={days.includes(day)}
                  onChange={(e) =>
                    setDays((v) => (e.target.checked ? [...v, day] : v.filter((n) => n !== day)))
                  }
                />
                {day === 0
                  ? en
                    ? 'On the due date'
                    : 'La scadență'
                  : day + ' ' + (en ? 'days before' : 'zile înainte')}
              </label>
            ))}
          </div>
          <label>
            {en
              ? 'Kilometer reminders · comma separated'
              : 'Alerte kilometraj · separate prin virgulă'}
            <input
              name="ac_alertKm"
              defaultValue={saved.alertKm || ''}
              placeholder="1000, 500, 100"
              pattern="[0-9, ]*"
              maxLength={100}
            />
          </label>
        </>
      )}
      {!custom && (
        <>
          <input type="hidden" name="ac_alertDays" value="inherit" />
          <input type="hidden" name="ac_alertKm" value="" />
        </>
      )}
      <p className="micro">
        {en
          ? 'Email and push use your enabled channels. Delivery requires the configured services and device permission. Mileage alerts use confirmed odometer readings.'
          : 'Emailul și push-ul folosesc canalele activate în cont. Trimiterea necesită servicii configurate și permisiunea dispozitivului. Alertele în kilometri folosesc citirile confirmate.'}
      </p>
    </fieldset>
  );
}
