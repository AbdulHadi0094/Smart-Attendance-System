import { DayOfWeek, PeriodTiming, PortalSettings } from '../types/erp';
import mcetCrestLogo from '../assets/images/mcet_crest_logo_1794650716318.jpg';

export const DEFAULT_PORTAL_SETTINGS: PortalSettings = {
  collegeName: 'Methodist College of Engineering and Technology',
  shortName: 'MCET',
  logoUrl: mcetCrestLogo,
  academicYear: '2026-27',
  semester: 'III',
  effectiveFrom: '03-08-2026',
  defaultClassroom: 'LH-E-303',
  timezone: 'Asia/Kolkata',
  lowAttendanceThreshold: 75,
};

export const WORKING_DAYS: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const PERIOD_TIMINGS: PeriodTiming[] = [
  { period: 1, roman: 'I', label: 'Period I', startTime: '09:15', endTime: '10:15', display: '09:15 AM – 10:15 AM' },
  { period: 2, roman: 'II', label: 'Period II', startTime: '10:15', endTime: '11:15', display: '10:15 AM – 11:15 AM' },
  { period: 3, roman: 'III', label: 'Period III', startTime: '11:15', endTime: '12:15', display: '11:15 AM – 12:15 PM' },
  { period: 4, roman: 'IV', label: 'Period IV', startTime: '12:15', endTime: '13:15', display: '12:15 PM – 01:15 PM' },
  { period: 5, roman: 'V', label: 'Period V', startTime: '14:00', endTime: '15:00', display: '02:00 PM – 03:00 PM' },
  { period: 6, roman: 'VI', label: 'Period VI', startTime: '15:00', endTime: '16:00', display: '03:00 PM – 04:00 PM' },
];

export const LUNCH_BREAK = {
  label: 'LUNCH BREAK',
  startTime: '13:15',
  endTime: '14:00',
  display: '01:15 PM – 02:00 PM',
};

export const MCET_DEPARTMENT_ID = 'dept_aiml';
export const MCET_CLASS_ID = 'class_iii_aiml_a_2026_27';

export const MCET_SUBJECT_SEEDS = [
  {
    id: 'sub_ldca',
    code: '',
    shortName: 'LDCA',
    name: 'Logical Design and Computer Architecture',
    type: 'theory' as const,
    facultyIds: ['fac_b_sowjanya'],
    facultyNames: ['Mrs. B. Sowjanya'],
  },
  {
    id: 'sub_ds',
    code: '',
    shortName: 'DS',
    name: 'Discrete Structures',
    type: 'theory' as const,
    facultyIds: ['fac_j_sowmya'],
    facultyNames: ['Mrs. J. Sowmya'],
  },
  {
    id: 'sub_dbms',
    code: '',
    shortName: 'DBMS',
    name: 'Database Management Systems',
    type: 'theory' as const,
    facultyIds: ['fac_v_saidulu'],
    facultyNames: ['Mr. V. Saidulu'],
  },
  {
    id: 'sub_os',
    code: '',
    shortName: 'OS',
    name: 'Operating Systems',
    type: 'theory' as const,
    facultyIds: ['fac_r_vinod_kumar'],
    facultyNames: ['Mr. R. Vinod Kumar'],
  },
  {
    id: 'sub_sac',
    code: '',
    shortName: 'SAC',
    name: 'Statistical Analytics and Computing using Python Programming',
    type: 'theory' as const,
    facultyIds: ['fac_hiba_anjum'],
    facultyNames: ['Ms. Hiba Anjum'],
  },
  {
    id: 'sub_hvpe',
    code: '',
    shortName: 'HVPE',
    name: 'Human Values and Professional Ethics',
    type: 'theory' as const,
    facultyIds: ['fac_jayashree'],
    facultyNames: ['Mrs. Jayashree'],
  },
  {
    id: 'sub_dbms_lab',
    code: '',
    shortName: 'DBMS Lab',
    name: 'Database Management Systems Lab',
    type: 'lab' as const,
    facultyIds: ['fac_v_saidulu', 'fac_yellappa'],
    facultyNames: ['Mr. V. Saidulu', 'Mr. Yellappa'],
  },
  {
    id: 'sub_os_lab',
    code: '',
    shortName: 'OS Lab',
    name: 'Operating Systems Lab',
    type: 'lab' as const,
    facultyIds: ['fac_r_vinod_kumar', 'fac_n_basaveshwara_rao'],
    facultyNames: ['Mr. R. Vinod Kumar', 'Mr. N. Basaveshwara Rao'],
  },
  {
    id: 'sub_sac_lab',
    code: '',
    shortName: 'SAC Lab',
    name: 'Statistical Analytics and Computing using Python Programming Lab',
    type: 'lab' as const,
    facultyIds: ['fac_hiba_anjum', 'fac_summayya_samreen'],
    facultyNames: ['Ms. Hiba Anjum', 'Mrs. Summayya Samreen'],
  },
  {
    id: 'sub_sec_iot',
    code: '',
    shortName: 'SEC-IOT',
    name: 'Skill Enhancement Course - IOT',
    type: 'lab' as const,
    facultyIds: ['fac_shaik_khaleel_ahmed', 'fac_prabhakar_rao'],
    facultyNames: ['Dr. Shaik Khaleel Ahmed', 'Mr. Prabhakar Rao'],
  },
  {
    id: 'sub_sports',
    code: '',
    shortName: 'SPORTS',
    name: 'Sports & Physical Education',
    type: 'activity' as const,
    facultyIds: [],
    facultyNames: ['Department Faculty'],
  },
  {
    id: 'sub_library',
    code: '',
    shortName: 'LIBRARY',
    name: 'Central Library Hour',
    type: 'activity' as const,
    facultyIds: [],
    facultyNames: ['Department Faculty'],
  },
  {
    id: 'sub_mentoring',
    code: '',
    shortName: 'MENTORING',
    name: 'Student Mentoring & Counseling',
    type: 'activity' as const,
    facultyIds: [],
    facultyNames: ['Class Mentors'],
  },
  {
    id: 'sub_digital_learning',
    code: '',
    shortName: 'DIGITAL LEARNING',
    name: 'Digital Learning & NPTEL / Self-Paced Study',
    type: 'activity' as const,
    facultyIds: [],
    facultyNames: ['Department Faculty'],
  },
];

export const MCET_FACULTY_SEEDS = [
  { id: 'fac_b_sowjanya', facultyCode: 'MCET-AIML-01', name: 'Mrs. B. Sowjanya', email: 'b.sowjanya@mcet.edu.in', designation: 'Assistant Professor', assignedSubjectIds: ['sub_ldca'] },
  { id: 'fac_j_sowmya', facultyCode: 'MCET-AIML-02', name: 'Mrs. J. Sowmya', email: 'j.sowmya@mcet.edu.in', designation: 'Assistant Professor', assignedSubjectIds: ['sub_ds'] },
  { id: 'fac_v_saidulu', facultyCode: 'MCET-AIML-03', name: 'Mr. V. Saidulu', email: 'v.saidulu@mcet.edu.in', designation: 'Assistant Professor', assignedSubjectIds: ['sub_dbms', 'sub_dbms_lab'] },
  { id: 'fac_r_vinod_kumar', facultyCode: 'MCET-AIML-04', name: 'Mr. R. Vinod Kumar', email: 'r.vinodkumar@mcet.edu.in', designation: 'Assistant Professor', assignedSubjectIds: ['sub_os', 'sub_os_lab'] },
  { id: 'fac_hiba_anjum', facultyCode: 'MCET-AIML-05', name: 'Ms. Hiba Anjum', email: 'hiba.anjum@mcet.edu.in', designation: 'Assistant Professor', assignedSubjectIds: ['sub_sac', 'sub_sac_lab'] },
  { id: 'fac_jayashree', facultyCode: 'MCET-AIML-06', name: 'Mrs. Jayashree', email: 'jayashree@mcet.edu.in', designation: 'Assistant Professor', assignedSubjectIds: ['sub_hvpe'] },
  { id: 'fac_yellappa', facultyCode: 'MCET-AIML-07', name: 'Mr. Yellappa', email: 'yellappa@mcet.edu.in', designation: 'Assistant Professor', assignedSubjectIds: ['sub_dbms_lab'] },
  { id: 'fac_n_basaveshwara_rao', facultyCode: 'MCET-AIML-08', name: 'Mr. N. Basaveshwara Rao', email: 'basaveshwararao@mcet.edu.in', designation: 'Assistant Professor', assignedSubjectIds: ['sub_os_lab'] },
  { id: 'fac_summayya_samreen', facultyCode: 'MCET-AIML-09', name: 'Mrs. Summayya Samreen', email: 'summayya.samreen@mcet.edu.in', designation: 'Assistant Professor', assignedSubjectIds: ['sub_sac_lab'] },
  { id: 'fac_shaik_khaleel_ahmed', facultyCode: 'MCET-AIML-10', name: 'Dr. Shaik Khaleel Ahmed', email: 'khaleel.ahmed@mcet.edu.in', designation: 'Professor', assignedSubjectIds: ['sub_sec_iot'] },
  { id: 'fac_prabhakar_rao', facultyCode: 'MCET-AIML-11', name: 'Mr. Prabhakar Rao', email: 'prabhakar.rao@mcet.edu.in', designation: 'Assistant Professor', assignedSubjectIds: ['sub_sec_iot'] },
];

export const MCET_TIMETABLE_SEEDS = [
  // MONDAY
  {
    id: 'tt_mon_p1_2',
    dayOfWeek: 'Monday' as DayOfWeek,
    periodNumber: 1,
    endPeriodNumber: 2,
    startTime: '09:15',
    endTime: '11:15',
    isMerged: true,
    isBatchSplit: true,
    slots: [
      {
        batch: 'B-I' as const,
        subjectId: 'sub_sac_lab',
        subjectShortName: 'SAC Lab',
        subjectName: 'Statistical Analytics and Computing using Python Programming Lab',
        facultyId: 'fac_hiba_anjum',
        facultyName: 'Ms. Hiba Anjum / Mrs. Summayya Samreen',
        classroom: 'LH-E-303',
      },
      {
        batch: 'B-II' as const,
        subjectId: 'sub_dbms',
        subjectShortName: 'DBMS',
        subjectName: 'Database Management Systems',
        facultyId: 'fac_v_saidulu',
        facultyName: 'Mr. V. Saidulu',
        classroom: 'LH-E-303',
      },
    ],
  },
  {
    id: 'tt_mon_p3_4',
    dayOfWeek: 'Monday' as DayOfWeek,
    periodNumber: 3,
    endPeriodNumber: 4,
    startTime: '11:15',
    endTime: '13:15',
    isMerged: true,
    isBatchSplit: true,
    slots: [
      {
        batch: 'B-II' as const,
        subjectId: 'sub_os_lab',
        subjectShortName: 'OS Lab',
        subjectName: 'Operating Systems Lab',
        facultyId: 'fac_r_vinod_kumar',
        facultyName: 'Mr. R. Vinod Kumar / Mr. N. Basaveshwara Rao',
        classroom: '103',
      },
      {
        batch: 'B-I' as const,
        subjectId: 'sub_dbms_lab',
        subjectShortName: 'DBMS Lab',
        subjectName: 'Database Management Systems Lab',
        facultyId: 'fac_v_saidulu',
        facultyName: 'Mr. V. Saidulu / Mr. Yellappa',
        classroom: '108',
      },
    ],
  },
  {
    id: 'tt_mon_p5',
    dayOfWeek: 'Monday' as DayOfWeek,
    periodNumber: 5,
    endPeriodNumber: 5,
    startTime: '14:00',
    endTime: '15:00',
    isMerged: false,
    isBatchSplit: false,
    slots: [
      {
        batch: 'ALL' as const,
        subjectId: 'sub_sac',
        subjectShortName: 'SAC',
        subjectName: 'Statistical Analytics and Computing using Python Programming',
        facultyId: 'fac_hiba_anjum',
        facultyName: 'Ms. Hiba Anjum',
        classroom: 'LH-E-303',
      },
    ],
  },
  {
    id: 'tt_mon_p6',
    dayOfWeek: 'Monday' as DayOfWeek,
    periodNumber: 6,
    endPeriodNumber: 6,
    startTime: '15:00',
    endTime: '16:00',
    isMerged: false,
    isBatchSplit: false,
    slots: [
      {
        batch: 'ALL' as const,
        subjectId: 'sub_ldca',
        subjectShortName: 'LDCA',
        subjectName: 'Logical Design and Computer Architecture',
        facultyId: 'fac_b_sowjanya',
        facultyName: 'Mrs. B. Sowjanya',
        classroom: 'LH-E-303',
      },
    ],
  },

  // TUESDAY
  {
    id: 'tt_tue_p1_2',
    dayOfWeek: 'Tuesday' as DayOfWeek,
    periodNumber: 1,
    endPeriodNumber: 2,
    startTime: '09:15',
    endTime: '11:15',
    isMerged: true,
    isBatchSplit: false,
    slots: [
      {
        batch: 'ALL' as const,
        subjectId: 'sub_sec_iot',
        subjectShortName: 'SEC-IOT',
        subjectName: 'Skill Enhancement Course - IOT',
        facultyId: 'fac_shaik_khaleel_ahmed',
        facultyName: 'Dr. Shaik Khaleel Ahmed / Mr. Prabhakar Rao',
        classroom: '402',
      },
    ],
  },
  {
    id: 'tt_tue_p3_4',
    dayOfWeek: 'Tuesday' as DayOfWeek,
    periodNumber: 3,
    endPeriodNumber: 4,
    startTime: '11:15',
    endTime: '13:15',
    isMerged: true,
    isBatchSplit: true,
    slots: [
      {
        batch: 'B-I' as const,
        subjectId: 'sub_sac_lab',
        subjectShortName: 'SAC / OS (Verify Batch)',
        subjectName: 'SAC / OS Batch Allocation (Confirm from Master Timetable)',
        facultyId: 'fac_hiba_anjum',
        facultyName: 'Ms. Hiba Anjum / Mr. R. Vinod Kumar',
        classroom: 'LH-E-303',
        needsConfirmation: true,
        note: 'Flagged for Admin confirmation: original timetable image was not attached to verify exact Tuesday III-IV B-I/B-II mapping.',
      },
      {
        batch: 'B-II' as const,
        subjectId: 'sub_os_lab',
        subjectShortName: 'OS / SAC (Verify Batch)',
        subjectName: 'OS / SAC Batch Allocation (Confirm from Master Timetable)',
        facultyId: 'fac_r_vinod_kumar',
        facultyName: 'Mr. R. Vinod Kumar / Ms. Hiba Anjum',
        classroom: 'LH-E-303',
        needsConfirmation: true,
        note: 'Flagged for Admin confirmation: original timetable image was not attached to verify exact Tuesday III-IV B-I/B-II mapping.',
      },
    ],
  },
  {
    id: 'tt_tue_p5',
    dayOfWeek: 'Tuesday' as DayOfWeek,
    periodNumber: 5,
    endPeriodNumber: 5,
    startTime: '14:00',
    endTime: '15:00',
    isMerged: false,
    isBatchSplit: false,
    slots: [
      {
        batch: 'ALL' as const,
        subjectId: 'sub_dbms',
        subjectShortName: 'DBMS',
        subjectName: 'Database Management Systems',
        facultyId: 'fac_v_saidulu',
        facultyName: 'Mr. V. Saidulu',
        classroom: 'LH-E-303',
      },
    ],
  },
  {
    id: 'tt_tue_p6',
    dayOfWeek: 'Tuesday' as DayOfWeek,
    periodNumber: 6,
    endPeriodNumber: 6,
    startTime: '15:00',
    endTime: '16:00',
    isMerged: false,
    isBatchSplit: false,
    slots: [
      {
        batch: 'ALL' as const,
        subjectId: 'sub_sac',
        subjectShortName: 'SAC',
        subjectName: 'Statistical Analytics and Computing using Python Programming',
        facultyId: 'fac_hiba_anjum',
        facultyName: 'Ms. Hiba Anjum',
        classroom: 'LH-E-303',
      },
    ],
  },

  // WEDNESDAY
  {
    id: 'tt_wed_p1',
    dayOfWeek: 'Wednesday' as DayOfWeek,
    periodNumber: 1,
    endPeriodNumber: 1,
    startTime: '09:15',
    endTime: '10:15',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_ldca', subjectShortName: 'LDCA', subjectName: 'Logical Design and Computer Architecture', facultyId: 'fac_b_sowjanya', facultyName: 'Mrs. B. Sowjanya', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_wed_p2',
    dayOfWeek: 'Wednesday' as DayOfWeek,
    periodNumber: 2,
    endPeriodNumber: 2,
    startTime: '10:15',
    endTime: '11:15',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_sac', subjectShortName: 'SAC', subjectName: 'Statistical Analytics and Computing using Python Programming', facultyId: 'fac_hiba_anjum', facultyName: 'Ms. Hiba Anjum', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_wed_p3',
    dayOfWeek: 'Wednesday' as DayOfWeek,
    periodNumber: 3,
    endPeriodNumber: 3,
    startTime: '11:15',
    endTime: '12:15',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_hvpe', subjectShortName: 'HVPE', subjectName: 'Human Values and Professional Ethics', facultyId: 'fac_jayashree', facultyName: 'Mrs. Jayashree', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_wed_p4',
    dayOfWeek: 'Wednesday' as DayOfWeek,
    periodNumber: 4,
    endPeriodNumber: 4,
    startTime: '12:15',
    endTime: '13:15',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_ds', subjectShortName: 'DS', subjectName: 'Discrete Structures', facultyId: 'fac_j_sowmya', facultyName: 'Mrs. J. Sowmya', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_wed_p5',
    dayOfWeek: 'Wednesday' as DayOfWeek,
    periodNumber: 5,
    endPeriodNumber: 5,
    startTime: '14:00',
    endTime: '15:00',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_os', subjectShortName: 'OS', subjectName: 'Operating Systems', facultyId: 'fac_r_vinod_kumar', facultyName: 'Mr. R. Vinod Kumar', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_wed_p6',
    dayOfWeek: 'Wednesday' as DayOfWeek,
    periodNumber: 6,
    endPeriodNumber: 6,
    startTime: '15:00',
    endTime: '16:00',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_sports', subjectShortName: 'SPORTS', subjectName: 'Sports & Physical Education', facultyId: '', facultyName: 'Department Faculty', classroom: 'Sports Ground' }],
  },

  // THURSDAY
  {
    id: 'tt_thu_p1',
    dayOfWeek: 'Thursday' as DayOfWeek,
    periodNumber: 1,
    endPeriodNumber: 1,
    startTime: '09:15',
    endTime: '10:15',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_os', subjectShortName: 'OS', subjectName: 'Operating Systems', facultyId: 'fac_r_vinod_kumar', facultyName: 'Mr. R. Vinod Kumar', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_thu_p2',
    dayOfWeek: 'Thursday' as DayOfWeek,
    periodNumber: 2,
    endPeriodNumber: 2,
    startTime: '10:15',
    endTime: '11:15',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_hvpe', subjectShortName: 'HVPE', subjectName: 'Human Values and Professional Ethics', facultyId: 'fac_jayashree', facultyName: 'Mrs. Jayashree', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_thu_p3',
    dayOfWeek: 'Thursday' as DayOfWeek,
    periodNumber: 3,
    endPeriodNumber: 3,
    startTime: '11:15',
    endTime: '12:15',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_ds', subjectShortName: 'DS', subjectName: 'Discrete Structures', facultyId: 'fac_j_sowmya', facultyName: 'Mrs. J. Sowmya', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_thu_p4',
    dayOfWeek: 'Thursday' as DayOfWeek,
    periodNumber: 4,
    endPeriodNumber: 4,
    startTime: '12:15',
    endTime: '13:15',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_sac', subjectShortName: 'SAC', subjectName: 'Statistical Analytics and Computing using Python Programming', facultyId: 'fac_hiba_anjum', facultyName: 'Ms. Hiba Anjum', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_thu_p5',
    dayOfWeek: 'Thursday' as DayOfWeek,
    periodNumber: 5,
    endPeriodNumber: 5,
    startTime: '14:00',
    endTime: '15:00',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_dbms', subjectShortName: 'DBMS', subjectName: 'Database Management Systems', facultyId: 'fac_v_saidulu', facultyName: 'Mr. V. Saidulu', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_thu_p6',
    dayOfWeek: 'Thursday' as DayOfWeek,
    periodNumber: 6,
    endPeriodNumber: 6,
    startTime: '15:00',
    endTime: '16:00',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_library', subjectShortName: 'LIBRARY', subjectName: 'Central Library Hour', facultyId: '', facultyName: 'Department Faculty', classroom: 'Central Library' }],
  },

  // FRIDAY
  {
    id: 'tt_fri_p1',
    dayOfWeek: 'Friday' as DayOfWeek,
    periodNumber: 1,
    endPeriodNumber: 1,
    startTime: '09:15',
    endTime: '10:15',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_ds', subjectShortName: 'DS', subjectName: 'Discrete Structures', facultyId: 'fac_j_sowmya', facultyName: 'Mrs. J. Sowmya', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_fri_p2',
    dayOfWeek: 'Friday' as DayOfWeek,
    periodNumber: 2,
    endPeriodNumber: 2,
    startTime: '10:15',
    endTime: '11:15',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_ldca', subjectShortName: 'LDCA', subjectName: 'Logical Design and Computer Architecture', facultyId: 'fac_b_sowjanya', facultyName: 'Mrs. B. Sowjanya', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_fri_p3',
    dayOfWeek: 'Friday' as DayOfWeek,
    periodNumber: 3,
    endPeriodNumber: 3,
    startTime: '11:15',
    endTime: '12:15',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_os', subjectShortName: 'OS', subjectName: 'Operating Systems', facultyId: 'fac_r_vinod_kumar', facultyName: 'Mr. R. Vinod Kumar', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_fri_p4',
    dayOfWeek: 'Friday' as DayOfWeek,
    periodNumber: 4,
    endPeriodNumber: 4,
    startTime: '12:15',
    endTime: '13:15',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_dbms', subjectShortName: 'DBMS', subjectName: 'Database Management Systems', facultyId: 'fac_v_saidulu', facultyName: 'Mr. V. Saidulu', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_fri_p5_6',
    dayOfWeek: 'Friday' as DayOfWeek,
    periodNumber: 5,
    endPeriodNumber: 6,
    startTime: '14:00',
    endTime: '16:00',
    isMerged: true,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_mentoring', subjectShortName: 'MENTORING', subjectName: 'Student Mentoring & Counseling', facultyId: '', facultyName: 'Class Mentors', classroom: 'LH-E-303' }],
  },

  // SATURDAY
  {
    id: 'tt_sat_p1',
    dayOfWeek: 'Saturday' as DayOfWeek,
    periodNumber: 1,
    endPeriodNumber: 1,
    startTime: '09:15',
    endTime: '10:15',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_dbms', subjectShortName: 'DBMS', subjectName: 'Database Management Systems', facultyId: 'fac_v_saidulu', facultyName: 'Mr. V. Saidulu', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_sat_p2',
    dayOfWeek: 'Saturday' as DayOfWeek,
    periodNumber: 2,
    endPeriodNumber: 2,
    startTime: '10:15',
    endTime: '11:15',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_ds', subjectShortName: 'DS', subjectName: 'Discrete Structures', facultyId: 'fac_j_sowmya', facultyName: 'Mrs. J. Sowmya', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_sat_p3',
    dayOfWeek: 'Saturday' as DayOfWeek,
    periodNumber: 3,
    endPeriodNumber: 3,
    startTime: '11:15',
    endTime: '12:15',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_os', subjectShortName: 'OS', subjectName: 'Operating Systems', facultyId: 'fac_r_vinod_kumar', facultyName: 'Mr. R. Vinod Kumar', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_sat_p4',
    dayOfWeek: 'Saturday' as DayOfWeek,
    periodNumber: 4,
    endPeriodNumber: 4,
    startTime: '12:15',
    endTime: '13:15',
    isMerged: false,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_ldca', subjectShortName: 'LDCA', subjectName: 'Logical Design and Computer Architecture', facultyId: 'fac_b_sowjanya', facultyName: 'Mrs. B. Sowjanya', classroom: 'LH-E-303' }],
  },
  {
    id: 'tt_sat_p5_6',
    dayOfWeek: 'Saturday' as DayOfWeek,
    periodNumber: 5,
    endPeriodNumber: 6,
    startTime: '14:00',
    endTime: '16:00',
    isMerged: true,
    isBatchSplit: false,
    slots: [{ batch: 'ALL' as const, subjectId: 'sub_digital_learning', subjectShortName: 'DIGITAL LEARNING', subjectName: 'Digital Learning & NPTEL / Self-Paced Study', facultyId: '', facultyName: 'Department Faculty', classroom: 'LH-E-303' }],
  },
];

export function getISTParts(date: Date = new Date()): {
  dateStr: string;
  timeStr: string;
  dayOfWeek: string;
} {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  const dayOfWeek = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
  }).format(date);

  return { dateStr, timeStr: timeParts, dayOfWeek };
}

export function resolvePeriodFromTime(timeHHMM: string): PeriodTiming | null {
  const [hStr, mStr] = timeHHMM.split(':');
  const mins = Number(hStr) * 60 + Number(mStr);
  for (const p of PERIOD_TIMINGS) {
    const [sh, sm] = p.startTime.split(':').map(Number);
    const [eh, em] = p.endTime.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    if (mins >= startMins && mins < endMins) {
      return p;
    }
  }
  return null;
}

export function getUpcomingPeriodFromTime(timeHHMM: string): PeriodTiming | null {
  const [hStr, mStr] = timeHHMM.split(':');
  const mins = Number(hStr) * 60 + Number(mStr);
  for (const p of PERIOD_TIMINGS) {
    const [sh, sm] = p.startTime.split(':').map(Number);
    if (sh * 60 + sm > mins) {
      return p;
    }
  }
  return null;
}
