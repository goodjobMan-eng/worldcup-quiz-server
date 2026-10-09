import { config, progress, type World } from './engine';
export type EducationRegion = { id: string; name: string; short: string; lat: number; lon: number; color: string; districts: string[] };
export type Classroom = { regionId: string; serverId: string; district: string; school: string; className: string; buildingCountry: string };
export type CampusBuilding = { id: string; regionId: string; serverId: string; school: string; className: string; title: string; kind: 'bridge' | 'school' | 'hospital'; progress: number; updatedAt: number; owner: string; code: string };
export const regions = (): EducationRegion[] => config().educationRegions || [];
export function serverId(regionId: string, district: string) {
  // A stable name-based key keeps existing worlds intact if the list order changes.
  let hash = 2166136261;
  for (const c of district.trim()) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return regionId + '-' + (hash >>> 0).toString(36);
}
export function validateClassroom(c: Classroom): Classroom {
  const region = regions().find(r => r.id === c.regionId);
  if (!region || !region.districts.includes(c.district) || c.serverId !== serverId(c.regionId, c.district)) throw Error('교육청과 교육지원청 서버를 다시 선택해 주세요.');
  if (!c.school.trim() || c.school.trim().length > 40 || !c.className.trim() || c.className.trim().length > 24) throw Error('학교 이름(40자 이내)과 학급(24자 이내)을 입력해 주세요.');
  if (!config().countries.some((n: any) => n.id === c.buildingCountry)) throw Error('학급 대표 건물을 선택해 주세요.');
  return {...c, school: c.school.trim(), className: c.className.trim()};
}
export function campusBuilding(w: World, now = Date.now()): CampusBuilding | null {
  const c = w.classroom;
  if (!c) return null;
  const spec = w.config.countries.find((n: any) => n.id === c.buildingCountry);
  return {id: c.serverId + '--' + w.code, regionId: c.regionId, serverId: c.serverId, school: c.school, className: c.className, title: spec.building.name, kind: c.buildingCountry === 'hualian' ? 'bridge' : c.buildingCountry === 'sahar' ? 'school' : 'hospital', progress: progress(w, c.buildingCountry), updatedAt: now, owner: w.teacher, code: w.code};
}
