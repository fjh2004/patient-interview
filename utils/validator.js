// 数据校验工具类
// 功能：问卷答案校验、逻辑一致性检查、输入验证

class Validator {
  // 必填项校验
  static validateRequired(question, answer) {
    if (!question.required) return { isValid: true, message: '' };
    
    if (answer === undefined || answer === null || answer === '') {
      return {
        isValid: false,
        message: `请填写${question.content}`
      };
    }
    
    // 对于多选和单选，检查是否选择了有效选项
    if (question.type === 'radio' || question.type === 'checkbox') {
      if (Array.isArray(answer) && answer.length === 0) {
        return {
          isValid: false,
          message: `请选择${question.content}`
        };
      }
      if (typeof answer === 'string' && answer.trim() === '') {
        return {
          isValid: false,
          message: `请选择${question.content}`
        };
      }
    }
    
    return { isValid: true, message: '' };
  }

  // 输入类型校验
  static validateInputType(question, answer) {
    if (!answer || answer === '') return { isValid: true, message: '' };
    
    switch (question.type) {
      case 'input_number':
        if (isNaN(Number(answer)) || answer.trim() === '') {
          return {
            isValid: false,
            message: '请输入有效数字'
          };
        }
        const num = Number(answer);
        if (num < 0 || num > 120) {
          return {
            isValid: false,
            message: '请输入1-120之间的有效年龄'
          };
        }
        break;
        
      case 'input_single':
      case 'input_multi':
        if (typeof answer !== 'string') {
          return {
            isValid: false,
            message: '请输入有效文本'
          };
        }
        break;
        
      default:
        break;
    }
    
    return { isValid: true, message: '' };
  }

    // 简单逻辑一致性校验（仅高频场景：选项互斥）
  static validateSimpleLogic(questionId, currentAnswer, allAnswers, questionnaire) {
    const checks = [];

    // 多选框互斥逻辑（"以上皆无"与其他选项互斥）
    const question = questionnaire.questions.find(q => q.id === questionId);
    if (question && question.type === 'checkbox') {
      if (Array.isArray(currentAnswer)) {
        const hasNoneOption = currentAnswer.includes('U. 以上皆无') ||
                             currentAnswer.includes('G. 以上皆无') ||
                             currentAnswer.includes('F. 以上皆无') ||
                             currentAnswer.includes('H. 以上皆无');

        if (hasNoneOption && currentAnswer.length > 1) {
          checks.push({
            isValid: false,
            message: '温馨提示：选择"以上皆无"时不能同时选择其他选项哦~',
            relatedQuestions: [questionId]
          });
        }
      }
    }

    return checks.length > 0 ? checks : [{ isValid: true, message: '' }];
  }

  // 全面逻辑一致性校验（检查所有已填写题目的逻辑关系）
  static validateAllLogic(allAnswers, questionnaire) {
    const checks = [];

    // 第6题和第8题逻辑关联（家族史-自身患病一致性）
    const q6Answers = allAnswers[6] || [];
    const q8Answers = allAnswers[8] || [];

    // 只在第8题已填写时才检查
    if (Array.isArray(q6Answers) && Array.isArray(q8Answers) && q8Answers.length > 0) {
      const hasFamilyDiabetes = q6Answers.includes('E. 糖尿病');
      const hasSelfDiabetes = q8Answers.includes('E. 糖尿病');
      const hasFamilyNone = q6Answers.includes('U. 以上皆无');
      const hasSelfNone = q8Answers.includes('U. 以上皆无');

      // 家族有糖尿病，但自身选择"以上皆无"
      if (hasFamilyDiabetes && hasSelfNone) {
        checks.push({
          isValid: false,
          message: '温馨提示：您提到家族有糖尿病史，目前自身无，建议后续注意健康监测哦~',
          relatedQuestions: [6, 8]
        });
      }
      // 家族无糖尿病，但自身有糖尿病
      else if (hasSelfDiabetes && hasFamilyNone) {
        checks.push({
          isValid: false,
          message: '温馨提示：您提到有糖尿病，但家族无相关病史，请注意健康管理哦~',
          relatedQuestions: [6, 8]
        });
      }
    }

    // 第8题和第9题逻辑关联（患病-用药一致性）
    const q9Answers = allAnswers[9] || [];

    // 只在第9题已填写时才检查
    if (Array.isArray(q8Answers) && Array.isArray(q9Answers) && q9Answers.length > 0) {
      const hasDiabetes = q8Answers.includes('E. 糖尿病');
      const hasDiabetesMed = q9Answers.includes('B. 降糖药');
      const hasMedNone = q9Answers.includes('G. 以上皆无');

      if (hasDiabetes && hasMedNone) {
        checks.push({
          isValid: false,
          message: '温馨提示：您提到有糖尿病，建议注意用药管理哦',
          relatedQuestions: [8, 9]
        });
      }
    }

    return checks.length > 0 ? checks : [];
  }

  // 单题完整校验
  static validateQuestion(question, answer, allAnswers, questionnaire) {
    const validations = [];
    
    // 必填校验
    const requiredCheck = this.validateRequired(question, answer);
    if (!requiredCheck.isValid) {
      validations.push(requiredCheck);
    }
    
    // 输入类型校验
    const typeCheck = this.validateInputType(question, answer);
    if (!typeCheck.isValid) {
      validations.push(typeCheck);
    }
    
    // 逻辑一致性校验（仅检查简单的选项互斥，复杂逻辑由LLM处理）
    if (requiredCheck.isValid && typeCheck.isValid) {
      const simpleLogicChecks = this.validateSimpleLogic(question.id, answer, allAnswers, questionnaire);
      validations.push(...simpleLogicChecks);
    }
    
    return validations;
  }

  // 全量校验（用于提交前）
  static validateAll(questionnaire, answers) {
    const errors = [];
    const warnings = [];

    // 获取性别，用于判断是否需要校验女性专属题
    const genderAnswer = answers[4];
    const isFemale = genderAnswer === 'B. 女性';

    questionnaire.questions.forEach(question => {
      // 男性用户跳过女性专属题（32、33题）
      if (!isFemale && (question.id === 32 || question.id === 33)) {
        return;
      }

      const answer = answers[question.id];
      const validations = this.validateQuestion(question, answer, answers, questionnaire);

      validations.forEach(validation => {
        if (!validation.isValid) {
          if (validation.relatedQuestions && validation.relatedQuestions.length > 0) {
            // 逻辑错误作为警告
            warnings.push({
              questionId: question.id,
              message: validation.message,
              relatedQuestions: validation.relatedQuestions
            });
          } else {
            // 必填和类型错误作为错误
            errors.push({
              questionId: question.id,
              message: validation.message
            });
          }
        }
      });
    });

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings
    };
  }

  // 生成用户友好的错误消息
  static formatValidationMessages(validationResult) {
    if (validationResult.isValid) {
      return '';
    }

    const errorMessages = validationResult.errors.map(error =>
      `第${error.questionId}题：${error.message}`
    );

    const warningMessages = validationResult.warnings.map(warning =>
      `第${warning.questionId}题：${warning.message}`
    );

    let message = '';

    if (errorMessages.length > 0) {
      message += `请完成以下必填项：\n${errorMessages.join('\n')}`;
    }

    if (warningMessages.length > 0) {
      if (message) message += '\n\n';
      message += `请注意以下逻辑一致性：\n${warningMessages.join('\n')}`;
    }

    return message;
  }

  // 检查是否所有必填题都已填写
  static checkRequiredCompletion(questionnaire, answers) {
    const unansweredRequired = questionnaire.questions.filter(question => 
      question.required && 
      (answers[question.id] === undefined || 
       answers[question.id] === null || 
       answers[question.id] === '' ||
       (Array.isArray(answers[question.id]) && answers[question.id].length === 0))
    );
    
    return {
      completed: unansweredRequired.length === 0,
      unanswered: unansweredRequired.map(q => q.id)
    };
  }
}

module.exports = Validator;