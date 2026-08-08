import { Document } from 'mongoose';

export interface INumericConstraint {
  min: number;
  max: number;
}

export interface INumericBlueprint {
  questionNum: number;
  concept: string;
  explanation?: string;
  type: 'NUMERIC';
  templateText: string;
  variableConstraints: Record<string, INumericConstraint>;
}

export interface IMatrixBlueprint {
  questionNum: number;
  concept: string;
  explanation?: string;
  type: 'MATRIX';
  templateText: string;
  matrixArrays: {
    targetGroup: string[];
    foilGroup: string[];
  };
}

export interface IGenerativeBlueprint {
  questionNum: number;
  concept: string;
  explanation?: string;
  type: 'GENERATIVE';
  templateText: string;
  promptTemplate?: string;
}

export type IBlueprintQuestion = INumericBlueprint | IMatrixBlueprint | IGenerativeBlueprint;

export interface IExamBlueprint {
  id: string;
  examId: string;
  examName: string;
  questions: IBlueprintQuestion[];
}

export interface IExamBlueprintDocument extends Omit<IExamBlueprint, 'id'>, Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}
