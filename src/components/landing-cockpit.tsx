import { Activity, Bell, CarFront, FileText, Gauge, House, MapPin, Wallet, Wrench } from 'lucide-react';
import { TitaniumWave } from './titanium-wave';

export function LandingCockpit() {
  return (
    <figure className="ac-landing-cockpit">
      <div className="ac-preview-devices" aria-hidden="true">
        <div className="ac-preview-laptop">
          <div className="ac-preview-screen">
            <aside>
              <strong><Activity /> AutoCare</strong>
              <span><House /> Acasă</span>
              <span><CarFront /> Garajul meu</span>
              <span><MapPin /> SmartDrive GPS</span>
              <span><Wrench /> Mentenanță</span>
              <span><FileText /> Documente</span>
              <span><Wallet /> Cheltuieli</span>
            </aside>
            <div className="ac-preview-main">
              <TitaniumWave />
              <span className="ac-preview-label">GARAJ DIGITAL</span>
              <strong>Mașina ta, la zi.</strong>
              <div className="ac-preview-metrics">
                <div><span className="ac-preview-ring"><Activity /></span> Starea întreținerii</div>
                <div><Gauge /> Kilometraj <strong>— km</strong></div>
                <div><Wallet /> Cheltuieli <strong>— RON</strong></div>
              </div>
              <div className="ac-preview-panels">
                <div>
                  <b>Evoluția cheltuielilor</b>
                  <svg viewBox="0 0 240 68" fill="none">
                    <path d="M0 17h240M0 34h240M0 51h240" stroke="#203353" />
                    <path d="M0 57 30 48 48 51 70 34 93 41 119 24 140 29 164 16 187 23 207 15 240 7" stroke="#398bff" strokeWidth="2" />
                  </svg>
                </div>
                <div><b>Remindere</b><span><Bell /> Revizie</span><span><FileText /> ITP</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="ac-preview-phone">
          <div className="ac-preview-notch" />
          <strong>AutoCare</strong>
          <div className="ac-preview-phone-card"><CarFront /> Garajul meu</div>
          <span className="ac-preview-ring"><Activity /></span>
          <b>Starea întreținerii</b>
          <div className="ac-preview-phone-tools"><MapPin /><Wrench /><FileText /></div>
          <div className="ac-preview-phone-card"><Bell /> Remindere</div>
          <div className="ac-preview-phone-nav"><House /><MapPin /><CarFront /><Wallet /></div>
        </div>
      </div>
      <figcaption>Previzualizare a interfeței · exemplu grafic</figcaption>
    </figure>
  );
}
