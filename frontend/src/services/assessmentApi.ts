import api from "./api";
import type { Assessment, AssessmentTemplate } from "../types/assessment";

export interface CreateAssessmentDTO {
  title: string;
  subject: string;
  grade: string;
  language?: string;
  academicYear?: string;
  duration?: number;
  totalMarks?: number;
  assessmentType?: string;
  questionPaper?: File;
}

export interface SaveTemplateDTO {
  questions: AssessmentTemplate["questions"];
  status?: "Draft";
  generatedBy?: string;
  modelName?: string;
}

export interface GenerateResult {
  ok: boolean;
  model: string;
  processingTime: number;
  preview: AssessmentTemplate;
}

const assessmentApi = {
  list(params?: Record<string, string>) {
    const qs = new URLSearchParams(params).toString();
    return api.get<{ assessments: Assessment[] }>(`/assessments${qs ? `?${qs}` : ""}`);
  },

  get(id: string) {
    return api.get<{ assessment: Assessment }>(`/assessments/${id}`);
  },

  create(data: CreateAssessmentDTO) {
    const form = new FormData();
    form.append("title", data.title);
    form.append("subject", data.subject);
    form.append("grade", data.grade);
    if (data.language) form.append("language", data.language);
    if (data.academicYear) form.append("academicYear", data.academicYear);
    if (data.duration) form.append("duration", String(data.duration));
    if (data.totalMarks) form.append("totalMarks", String(data.totalMarks));
    if (data.questionPaper) form.append("questionPaper", data.questionPaper);
    return api.post<{ assessment: Assessment }>("/assessments", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  createWithForm(form: FormData) {
    return api.post<{ assessment: Assessment }>("/assessments", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  createWithFiles(data: CreateAssessmentDTO, files: File[]) {
    const form = new FormData();
    form.append("title", data.title);
    form.append("subject", data.subject);
    form.append("grade", data.grade);
    if (data.language) form.append("language", data.language);
    if (data.academicYear) form.append("academicYear", data.academicYear);
    if (data.duration) form.append("duration", String(data.duration));
    if (data.totalMarks) form.append("totalMarks", String(data.totalMarks));
    if (data.assessmentType) form.append("assessmentType", data.assessmentType);
    files.forEach((f) => form.append("questionPapers", f));
    return api.post<{ assessment: Assessment }>("/assessments", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  delete(id: string) {
    return api.delete<{ ok: boolean }>(`/assessments/${id}`);
  },

  generateTemplate(id: string) {
    return api.post<GenerateResult>(`/assessments/${id}/generate-template`);
  },

  getTemplate(assessmentId: string) {
    return api.get<{ template: AssessmentTemplate }>(`/templates/${assessmentId}`);
  },

  saveTemplate(assessmentId: string, data: SaveTemplateDTO) {
    return api.put<{ template: AssessmentTemplate }>(`/templates/${assessmentId}`, data);
  },

  approveTemplate(assessmentId: string) {
    return api.post<{ template: AssessmentTemplate }>(`/templates/${assessmentId}/approve`);
  },

  regenerateQuestion(assessmentId: string, questionIndex: number, promptHint?: string) {
    return api.post<{ ok: boolean; question: import("../types/assessment").Question }>(
      `/templates/${assessmentId}/regenerate/${questionIndex}`,
      { promptHint: promptHint || "Provide a complete answer for this single question. If the question references an image, look at it carefully and provide your best specific answer." }
    );
  },

  deleteTemplate(assessmentId: string) {
    return api.delete<{ ok: boolean }>(`/templates/${assessmentId}`);
  },
};

export default assessmentApi;