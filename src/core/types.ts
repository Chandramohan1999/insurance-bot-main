export type EntityId = string;

export interface Entity {
  id: EntityId;
  type: string;
  data: Record<string, any>;
}

export interface EntityStore {
  getAll(type?: string): Promise<Entity[]>;
  get(id: EntityId): Promise<Entity | null>;
  add(entity: Entity): Promise<EntityId>;
  update(id: EntityId, data: Record<string, any>): Promise<boolean>;
  delete(id: EntityId): Promise<boolean>;
  getCurrentEntity(type: string): Promise<Entity | null>;
  setCurrentEntity(type: string, entity: Entity): Promise<void>;
}

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export interface ValidationContext {
  currentEntityType?: string;
  userAnswers: Record<string, string>;
}

export type ValidationFunction = (
  value: string,
  context?: ValidationContext
) => ValidationResult;

export interface Question {
  id: string;
  text: string;
  options?: string[];
  validationType: string;
}

export interface QuestionWithEntity {
  id: string;
  entity: string;
  action: string;
  transform?: (value: string) => Record<string, any>;
}

export interface SkipRule {
  questionId: string;
  conditions: Array<{
    type: string;
    field?: string;
    value?: any;
    values?: any[];
  }>;
  operator?: "and" | "or";
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  questionIds: QuestionWithEntity[];
  skipRules: SkipRule[];
}

export interface QuestionWithLogic extends Question {
  validation: ValidationFunction;
  skip: (context: ValidationContext) => boolean;
  entity: string;
  action: string;
  transform?: (value: string) => Record<string, any>;
}

export interface WorkflowData {
  id: string;
  name: string;
  questions: QuestionWithLogic[];
}

export interface UserConversationState {
  phoneNumber: string;
  workflowId: string | null;
  currentQuestionIndex: number;
  policyId?: EntityId;
  memberId?: EntityId;
  lastMessageTimestamp: Date;
  answers: Record<string, string>;
  workflowHistory: string[];
  isWaitingForResponse: boolean;
  pendingTransition?: string | null;
}

export interface WorkflowTransition {
  type: "askYesNo" | "auto" | "conditional" | "menu";
  question?: string;
  action?: string;
  nextWorkflow?: string | null;
  condition?: {
    field: string;
    equals?: string;
    notEquals?: string;
    in?: string[];
    exists?: boolean;
  };
  onTrue?: {
    action: string;
    nextWorkflow: string | null;
  };
  onFalse?: {
    action: string;
    nextWorkflow: string | null;
  };
  options?: Array<{
    text: string;
    action: {
      action: string;
      nextWorkflow: string | null;
    };
  }>;
}

export interface EnhancedWorkflow extends Workflow {
  transitions?: WorkflowTransition[];
}

export interface PayPalPaymentRequest {
  userId: string;
  amount: number;
  currency?: string;
  description?: string;
  productType?: string | null;
  policyPeriod?: string | null;
  policyId?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PayPalPaymentResponse {
  id: string;
  approvalUrl: string;
  status: string;
  gatewayPaymentId: string;
  gatewayResponse?: any;
}
// Add these to your src/core/types.ts file

export interface Condition {
  type: string;
  field?: string;
  value?: any;
  values?: any[];
}

// Make sure the SkipRule interface uses the Condition interface
export interface SkipRule {
  questionId: string;
  conditions: Array<Condition>;
  operator?: "and" | "or";
}

// Update the WorkflowTransition interface to match the JSON data
export interface WorkflowTransition {
  type: "askYesNo" | "auto" | "conditional" | "menu";
  question?: string;
  action?: string;
  entityType?: string;
  data?: Record<string, any>;
  nextWorkflow?: string | null;
  condition?: {
    field: string;
    equals?: string;
    notEquals?: string;
    in?: string[];
    exists?: boolean;
  };
  onTrue?: {
    action: string;
    nextWorkflow: string | null;
  };
  onFalse?: {
    action: string;
    nextWorkflow: string | null;
  };
  onYes?: {
    action: string;
    entityType?: string;
    data?: Record<string, any>;
    nextWorkflow: string | null;
  };
  onNo?: {
    action: string;
    nextWorkflow: string | null;
  };
  options?: Array<{
    text: string;
    action: {
      action: string;
      nextWorkflow: string | null;
    };
  }>;
}
