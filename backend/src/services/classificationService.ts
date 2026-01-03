import { RowDataPacket } from 'mysql2/promise';
import { query } from '../config/database.js';

export interface EmployeeProfile {
  citizen_id: string;
  position_name: string;
  specialist: string | null;
  expert: string | null;
  sub_department: string | null;
}

export interface MasterRate {
  rate_id: number;
  profession_code: string;
  group_no: number;
  item_no: string;
  amount: number;
}

/**
 * Resolve recommended rate for a citizen based on precise position matching.
 */
export async function findRecommendedRate(citizenId: string): Promise<MasterRate | null> {
  const rows = await query<RowDataPacket[]>(
    `SELECT citizen_id, position_name, specialist, expert, sub_department 
     FROM pts_employees WHERE citizen_id = ?`,
    [citizenId]
  );

  if (!rows || rows.length === 0) return null;
  const profile = rows[0] as EmployeeProfile;

  let targetProfession = '';
  let targetGroup = 1;

  const pos = (profile.position_name || '').trim();
  const specialist = (profile.specialist || '').trim();
  const expert = (profile.expert || '').trim();
  const subDept = (profile.sub_department || '').trim();

  if (!subDept && (pos.includes('พยาบาล') || pos.includes('เภสัช'))) {
    console.warn(
      `[Audit] Missing sub_department for ${citizenId} (${pos}). Classification may be downgraded.`
    );
  }

  const isDoctor =
    pos.startsWith('นายแพทย์') || pos === 'ผู้อำนวยการเฉพาะด้าน (แพทย์)';
  const isDentist =
    pos.startsWith('ทันตแพทย์') || pos === 'ผู้อำนวยการเฉพาะด้าน (ทันตแพทย์)';
  const isPharmacist =
    pos.startsWith('เภสัชกร') || pos === 'ผู้อำนวยการเฉพาะด้าน (เภสัชกรรม)';
  const isNurse = ['พยาบาลวิชาชีพ', 'พยาบาลเทคนิค', 'วิสัญญีพยาบาล'].some((p) =>
    pos.startsWith(p)
  );

  if (isDoctor) {
    targetProfession = 'DOCTOR';
    const group3Keywords = ['นิติเวช', 'จิตเวช', 'ประสาทศัลย', 'ทรวงอก', 'ระบาดวิทยา', 'พยาธิ'];
    if (group3Keywords.some((k) => specialist.includes(k) || expert.includes(k))) {
      targetGroup = 3;
    } else if (
      specialist !== '' ||
      expert.includes('เวชกรรม') ||
      expert.includes('ปริญญาโท') ||
      expert.includes('คุณภาพ')
    ) {
      targetGroup = 2;
    }
  } else if (isDentist) {
    targetProfession = 'DENTIST';
    if (expert.includes('ทันตกรรม') || specialist !== '') {
      targetGroup = 3;
    } else if (expert.includes('ปริญญาโท') || expert.includes('ปริญญาเอก')) {
      targetGroup = 2;
    }
  } else if (isPharmacist) {
    targetProfession = 'PHARMACIST';
    if (subDept.includes('เคมีบำบัด') || subDept.includes('คุ้มครอง') || expert.includes('เอดส์')) {
      targetGroup = 2;
    }
  } else if (isNurse) {
    targetProfession = 'NURSE';
    const g3Sub = ['ICU', 'CCU', 'วิกฤต', 'วิสัญญี'];
    const g3Exp = ['วิกฤต', 'วิสัญญี', 'APN', 'ติดเชื้อรุนแรง'];
    const g2Sub = ['OR', 'ER', 'LR', 'ห้องคลอด', 'ไตเทียม', 'Ward', 'ตึก', 'เคมีบำบัด'];
    const g2Exp = ['ผู้คลอด', 'จิต', 'ยาเสพติด', 'ฟื้นฟู'];

    if (g3Sub.some((k) => subDept.includes(k)) || g3Exp.some((k) => expert.includes(k))) {
      targetGroup = 3;
    } else if (g2Sub.some((k) => subDept.includes(k)) || g2Exp.some((k) => expert.includes(k))) {
      targetGroup = 2;
    }
  } else {
    const alliedPos = ['นักเทคนิคการแพทย์', 'นักรังสี', 'นักกายภาพ', 'นักกิจกรรม', 'นักจิตวิทยา', 'นักเทคโนโลยีหัวใจ'];
    if (alliedPos.some((k) => pos.startsWith(k))) {
      targetProfession = 'ALLIED';
      targetGroup = 1;
    }
  }

  if (!targetProfession) return null;

  const rates = await query<RowDataPacket[]>(
    `SELECT * FROM pts_master_rates 
       WHERE profession_code = ? AND group_no = ? AND is_active = 1
       ORDER BY amount DESC LIMIT 1`,
    [targetProfession, targetGroup]
  );

  return rates.length > 0 ? (rates[0] as MasterRate) : null;
}

export async function getAllActiveMasterRates(): Promise<RowDataPacket[]> {
  return await query<RowDataPacket[]>(`SELECT * FROM pts_master_rates WHERE is_active = 1`);
}
