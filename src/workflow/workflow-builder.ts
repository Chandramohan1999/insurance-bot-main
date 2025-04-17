import {
  Condition,
  Question,
  QuestionWithEntity,
  QuestionWithLogic,
  SkipRule,
  ValidationContext,
  Workflow,
  WorkflowData,
  EnhancedWorkflow,
  WorkflowTransition,
} from "../core/types";
import { getValidator } from "../validators/validators";

export class WorkflowBuilder {
  private questions: Record<string, Question>;
  private workflows: Record<string, EnhancedWorkflow>;

  constructor() {
    this.questions = {};
    this.workflows = {};
  }

  private evaluateCondition(
    condition: Condition,
    context: ValidationContext
  ): boolean {
    if (!condition.field) return false;

    // Get the field value from user answers
    const fieldValue = context.userAnswers[condition.field];

    // Evaluate based on condition type
    switch (condition.type) {
      case "equals":
        return fieldValue === condition.value;
      case "notEquals":
        return fieldValue !== condition.value;
      case "in":
        return condition.values?.includes(fieldValue) || false;
      case "notIn":
        return !condition.values?.includes(fieldValue) || false;
      case "exists":
        return (
          fieldValue !== undefined && fieldValue !== null && fieldValue !== ""
        );
      case "notExists":
        return (
          fieldValue === undefined || fieldValue === null || fieldValue === ""
        );
      default:
        return false;
    }
  }

  loadFromJson(data: {
    questions: Question[];
    workflows: EnhancedWorkflow[];
  }): void {
    this.registerQuestions(data.questions);
    this.registerWorkflows(data.workflows);
  }

  registerQuestion(question: Question): void {
    this.questions[question.id] = question;
  }

  registerQuestions(questions: Question[]): void {
    questions.forEach((question) => this.registerQuestion(question));
  }

  registerWorkflow(workflow: EnhancedWorkflow): void {
    this.workflows[workflow.id] = workflow;
  }

  registerWorkflows(workflows: EnhancedWorkflow[]): void {
    workflows.forEach((workflow) => this.registerWorkflow(workflow));
  }

  getQuestions(): Question[] {
    return Object.values(this.questions);
  }

  getWorkflows(): EnhancedWorkflow[] {
    return Object.values(this.workflows);
  }

  getQuestion(id: string): Question | null {
    return this.questions[id] || null;
  }

  getWorkflow(id: string): EnhancedWorkflow | null {
    return this.workflows[id] || null;
  }

  getWorkflowTransitions(workflowId: string): WorkflowTransition[] {
    const workflow = this.getWorkflow(workflowId);
    return workflow?.transitions || [];
  }

  buildWorkflow(workflowId: string): WorkflowData | null {
    const workflow = this.getWorkflow(workflowId);

    if (!workflow) {
      console.error(`Workflow with ID ${workflowId} not found`);
      return null;
    }

    // Convert workflow to WorkflowData with questions enhanced with logic
    const questions: QuestionWithLogic[] = [];

    // Add questions in the order defined in the workflow
    for (const questionWithEntity of workflow.questionIds) {
      const questionId = questionWithEntity.id;
      const questionData = this.getQuestion(questionId);

      if (!questionData) {
        console.warn(`Question with ID ${questionId} not found`);
        continue;
      }

      // Find skip rules for this question
      const skipRules = workflow.skipRules.filter(
        (rule) => rule.questionId === questionId
      );

      // Create a skip function based on the skip rules
      const skipFunction = this.buildSkipFunction(skipRules);

      // Create question with validation, skip logic, entity, and action
      const questionWithLogic: QuestionWithLogic = {
        ...questionData,
        validation: getValidator(questionData.validationType),
        skip: skipFunction,
        entity: questionWithEntity.entity,
        action: questionWithEntity.action,
        transform: questionWithEntity.transform,
      };

      questions.push(questionWithLogic);
    }

    return {
      id: workflow.id,
      name: workflow.name,
      questions,
    };
  }

  private buildSkipFunction(
    skipRules: SkipRule[]
  ): (context: ValidationContext) => boolean {
    // If no skip rules, never skip
    if (skipRules.length === 0) {
      return () => false;
    }

    return (context: ValidationContext): boolean => {
      // If any rule evaluates to true, skip the question
      for (const rule of skipRules) {
        // Default operator is "and"
        const operator = rule.operator || "and";

        // Evaluate all conditions
        const results: boolean[] = [];

        for (const condition of rule.conditions) {
          const result = this.evaluateCondition(condition, context);
          results.push(result);
        }

        // Determine if the rule is satisfied based on the operator
        let ruleSatisfied: boolean;

        if (operator === "and") {
          // All conditions must be true
          ruleSatisfied = results.every((result) => result === true);
        } else {
          // At least one condition must be true
          ruleSatisfied = results.some((result) => result === true);
        }

        // If rule is satisfied, skip the question
        if (ruleSatisfied) {
          return true;
        }
      }

      // If no rules were satisfied, don't skip the question
      return false;
    };
  }
}
