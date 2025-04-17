import {
  ValidationFunction,
  ValidationResult,
  ValidationContext,
} from "../core/types";

class ValidatorRegistry {
  private validators: Record<string, ValidationFunction> = {};

  register(type: string, validator: ValidationFunction): void {
    this.validators[type] = validator;
  }

  get(type: string): ValidationFunction | undefined {
    return this.validators[type];
  }

  has(type: string): boolean {
    return !!this.validators[type];
  }
}

export const validatorRegistry = new ValidatorRegistry();

export function getValidator(type: string): ValidationFunction {
  const validator = validatorRegistry.get(type);

  if (!validator) {
    console.warn(`No validator found for type: ${type}, using 'any' validator`);
    return validatorRegistry.get("any") || ((value) => ({ isValid: true }));
  }

  return validator;
}

// Register built-in validators
validatorRegistry.register("any", (value: string): ValidationResult => {
  return { isValid: true };
});

validatorRegistry.register("required", (value: string): ValidationResult => {
  if (!value || value.trim() === "") {
    return {
      isValid: false,
      message: "This field is required",
    };
  }
  return { isValid: true };
});

validatorRegistry.register("name", (value: string): ValidationResult => {
  if (!value || value.trim().length < 2) {
    return {
      isValid: false,
      message: "Please enter a valid name (at least 2 characters)",
    };
  }
  return { isValid: true };
});

validatorRegistry.register("date", (value: string): ValidationResult => {
  // Accept ISO date format (YYYY-MM-DD)
  const re = /^\d{4}-\d{2}-\d{2}$/;

  if (!re.test(value)) {
    return {
      isValid: false,
      message: "Please follow the YYYY-MM-DD format (e.g. 2025-03-28)",
    };
  }

  // Validate date is real
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      message: "Please enter a valid date",
    };
  }

  return { isValid: true };
});

validatorRegistry.register("email", (value: string): ValidationResult => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(value)) {
    return {
      isValid: false,
      message: "Please enter a valid email address",
    };
  }
  return { isValid: true };
});

validatorRegistry.register("phone", (value: string): ValidationResult => {
  const re = /^\d{10,15}$/;
  if (!re.test(value.replace(/[\s-()]/g, ""))) {
    return {
      isValid: false,
      message: "Please enter a valid phone number (10-15 digits)",
    };
  }
  return { isValid: true };
});

validatorRegistry.register(
  "option",
  (value: string, context?: ValidationContext): ValidationResult => {
    // Get options from the question context
    if (!context || !context.userAnswers.options) {
      return { isValid: true }; // No context to validate against
    }

    const options = context.userAnswers.options.split(",");

    if (options.length > 0 && !options.includes(value)) {
      return {
        isValid: false,
        message: `Please select one of the options: ${options.join(", ")}`,
      };
    }

    return { isValid: true };
  }
);

validatorRegistry.register("passport", (value: string): ValidationResult => {
  const re = /^[A-Z0-9]{6,12}$/;
  if (!re.test(value)) {
    return {
      isValid: false,
      message:
        "Please enter a valid passport number (6-12 alphanumeric characters)",
    };
  }
  return { isValid: true };
});
