import { apiFetch, withBase } from '../services/apiClient';
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { User, UserRole, Student, ClassGroup, School, LogEntry, Ticket } from '../types';

import { DiagnosticWorkflow } from './DiagnosticWorkflow';
import { BulkDiagnosticWorkflow } from './BulkDiagnosticWorkflow';
import { WorksheetWorkflow } from './WorksheetWorkflow';
import { LogbookView } from './LogbookView';
import { TicketSubmission } from './TicketSubmission';
import { IcrScanner } from './IcrScanner';
import { BaselineUpload } from './BaselineUpload';
import { SkillGraphPanel } from './SkillGraphPanel';
import { Users, ShieldAlert, BookOpen, UserCheck, Calendar, ArrowRight, CheckCircle2, XCircle, SlidersHorizontal, Layers, Award, MapPin, School as SchoolIcon, BarChart3, FileText, ClipboardList, Layers as BulkIcon } from 'lucide-react';
import { Table, Column } from './Table';
import { MetricCard } from './Card';
import { Input, Select, Textarea } from './Form';
import { SuperAdminExecutiveDashboard } from './SuperAdminExecutiveDashboard';



export { FLN_LEVELS_LIST, FLNLevelReferenceModal } from './dashboards/FLNLevelReference';

export const STATE_NAMES: Record<string, string> = {
  'PB': 'Punjab',
  'HR': 'Haryana',
  'RJ': 'Rajasthan',
  'UP': 'Uttar Pradesh'
};

export const DISTRICT_NAMES: Record<string, string> = {
  'LDH': 'Ludhiana',
  'MOG': 'Moga',
  'AMB': 'Ambala',
  'JAI': 'Jaipur',
  'LKO': 'Lucknow'
};

// export type { DashboardProps };

export function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function parseCSVText(text: string): Record<string, any>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row.');
  }

  const rawHeaders = splitCSVLine(lines[0]);
  const headerMap: Record<string, string> = {
    'name': 'name',
    'class': 'classGroup',
    'classgroup': 'classGroup',
    'section': 'section',
    'aadhar': 'aadharNumber',
    'aadharnumber': 'aadharNumber',
    'id': 'aadharNumber',
    'idcard': 'aadharNumber',
    'id card': 'aadharNumber',
    'dob': 'dob',
    'date of birth': 'dob',
    'date-of-birth': 'dob',
    'gender': 'gender',
    'guardianname': 'guardianName',
    'guardian name': 'guardianName',
    'guardianrelation': 'guardianRelation',
    'guardian relation': 'guardianRelation',
    'guardiancontact': 'guardianContact',
    'guardian contact': 'guardianContact',
    'address': 'address',
    'bloodgroup': 'bloodGroup',
    'blood group': 'bloodGroup',
    'disabilitystatus': 'disabilityStatus',
    'disability status': 'disabilityStatus',
    'middaymealbeneficiary': 'midDayMealBeneficiary',
    'mid day meal beneficiary': 'midDayMealBeneficiary',
    'busroute': 'busRoute',
    'bus route': 'busRoute',
    'siblingsinschool': 'siblingsInSchool',
    'siblings in school': 'siblingsInSchool'
  };

  const headers = rawHeaders.map(h => {
    const clean = h.trim().toLowerCase();
    return headerMap[clean] || clean;
  });

  return lines.slice(1).map(line => {
    const vals = splitCSVLine(line);
    const row: Record<string, any> = {};
    headers.forEach((h, i) => {
      let val = (vals[i] || '').trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).trim();
      }

      // Normalize classGroup (e.g. '2' -> 'Class 2')
      if (h === 'classGroup') {
        const numMatch = val.match(/\d+/);
        if (numMatch) {
          val = `Class ${numMatch[0]}`;
        } else if (val.toLowerCase().includes('preschool 1')) {
          val = 'Preschool 1';
        } else if (val.toLowerCase().includes('preschool 2')) {
          val = 'Preschool 2';
        } else if (val.toLowerCase().includes('balvatika')) {
          val = 'Balvatika';
        }
      }

      // Normalize dob (DD-MM-YYYY or DD/MM/YYYY to YYYY-MM-DD)
      if (h === 'dob' && val) {
        const dmyMatch = val.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (dmyMatch) {
          const day = dmyMatch[1].padStart(2, '0');
          const month = dmyMatch[2].padStart(2, '0');
          const year = dmyMatch[3];
          val = `${year}-${month}-${day}`;
        }
      }

      // Normalize aadharNumber (scientific notation)
      if (h === 'aadharNumber' && val) {
        if (/^\d+(\.\d+)?[eE]\+?\d+$/.test(val)) {
          try {
            val = Number(val).toFixed(0);
          } catch (e) {
            // fallback
          }
        }
      }

      row[h] = val;
    });
    return row;
  });
}

interface DashboardProps {
  user: User;
  token: string;
}

// ==========================================
// GEOGRAPHICAL COMPARATIVE ANALYTICS (SHARED VIEW)
// ==========================================
import { RegionalAnalyticsView } from './dashboards/RegionalAnalyticsView';
export { RegionalAnalyticsView } from './dashboards/RegionalAnalyticsView';

// ==========================================
// 1. SUPERADMIN (NATIONAL) DASHBOARD
// ==========================================
import { SuperadminDashboard } from './dashboards/SuperadminDashboard';
export { SuperadminDashboard } from './dashboards/SuperadminDashboard';



// ==========================================
// 2. STATE ADMIN / DISTRICT ADMIN / BLOCK ADMIN DASHBOARDS
// ==========================================
export { AdminDashboard } from './dashboards/AdminDashboard';


// ==========================================
// 3. SCHOOL PRINCIPAL DASHBOARD
// ==========================================
export { SchoolDashboard } from './dashboards/SchoolDashboard';


/** Renders either a crisp level chip or an animated "Awaiting Diagnostic" badge */
export function LevelBadge({ level, subLevel, variant = 'compact' }: {
  level: number | null | undefined;
  subLevel?: number | null;
  variant?: 'compact' | 'full';
}) {
  if (level !== null && level !== undefined) {
    // Placed student — clean level chip
    if (variant === 'full') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          L{level}{subLevel !== null && subLevel !== undefined ? `.${subLevel}` : ''}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs">
        L{level}{subLevel !== null && subLevel !== undefined ? `.${subLevel}` : ''}
      </span>
    );
  }

  // Unplaced student — animated awaiting badge
  if (variant === 'full') {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-semibold text-sm select-none">
        {/* Pulsing radar dot */}
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
        </span>
        Awaiting Diagnostic
      </span>
    );
  }

  // compact table / list variant
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-[10px] font-bold font-mono select-none whitespace-nowrap">
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
      </span>
      Diagnostic Pending
    </span>
  );
}

// ==========================================
// 4. TEACHER DASHBOARD
// ==========================================
import { TeacherDashboard } from './dashboards/TeacherDashboard';
export { TeacherDashboard } from './dashboards/TeacherDashboard';


// ==========================================
// 5. VOLUNTEER DASHBOARD
// ==========================================
import { VolunteerDashboard } from './dashboards/VolunteerDashboard';
export { VolunteerDashboard } from './dashboards/VolunteerDashboard';
