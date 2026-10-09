import { regions, serverId } from './servers';
export default function ServerPicker({regionId, district, onChange, disabled = false}: {regionId: string; district: string; onChange: (region: string, district: string) => void; disabled?: boolean}) {
  const region = regions().find(r => r.id === regionId) || regions()[0];
  return <fieldset className="server-picker" disabled={disabled}>
    <legend>접속할 서버 선택</legend>
    <div className="server-selects">
      <label>시·도교육청<select aria-label="시·도교육청" value={regionId} onChange={e => {const r = regions().find(r => r.id === e.target.value)!; onChange(r.id, r.districts[0]);}}>{regions().map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label>교육지원청 서버<select aria-label="교육지원청 서버" value={district} onChange={e => onChange(region.id, e.target.value)}>{region.districts.map(d => <option key={d} value={d}>{d === '본청 직영' ? '본청 직영 서버' : `${d}교육지원청 서버`}</option>)}</select></label>
    </div>
    <p className="server-picked"><span className="dot" />{region.short} · {district} 서버 <small>{serverId(region.id, district)}</small></p>
  </fieldset>;
}
