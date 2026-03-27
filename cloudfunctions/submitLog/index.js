// 日志收集云函数 - 简化版，只记录必要指标
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 主函数 - 处理各种日志收集
 */
async function main(event, context) {
  const { logType, ...logData } = event;

  try {
    switch (logType) {
      case 'session_start':
        return await handleSessionStart(logData);

      case 'session_end':
        return await handleSessionEnd(logData);

      case 'llm_interaction':
        return await handleLLMInteraction(logData);

      default:
        return {
          success: false,
          message: '未知的日志类型'
        };
    }

  } catch (error) {
    console.error('日志收集失败：', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * 处理会话开始日志
 */
async function handleSessionStart(data) {
  const {
    session_id,
    user_id,
    group,
    start_time
  } = data;

  try {
    // 使用 add 方法插入新文档，如果已存在则更新
    await db.collection('user_sessions').doc(session_id).set({
      data: {
        session_id: session_id,
        user_id: user_id,
        group: group,
        status: 'in_progress',
        has_skip: false,
        start_time: start_time,
        end_time: null,
        duration: 0,
        exit_question_index: null,
        created_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    });

    console.log('[云函数] 会话开始记录成功:', { session_id, start_time });
    return { success: true, session_id: session_id };
  } catch (error) {
    console.error('记录会话开始失败：', error);
    return { success: false, message: error.message };
  }
}

/**
 * 处理会话结束日志
 */
async function handleSessionEnd(data) {
  const {
    session_id,
    user_id,
    group,
    start_time,
    end_time,
    duration,
    status,
    exit_question_index,
    has_skip,
    exit_count = 0,  // 新增，默认值为0
    last_exit_time = null  // 新增，默认值为null
  } = data;

  try {
    // 先尝试获取当前的会话记录
    let effectiveStartTime = start_time;
    let effectiveDuration = duration;
    
    try {
      const sessionDoc = await db.collection('user_sessions').doc(session_id).get();
      if (sessionDoc.data) {
        // 如果数据库中的start_time存在且有效，使用它
        const dbStartTime = sessionDoc.data.start_time;
        if (dbStartTime && dbStartTime > 0) {
          effectiveStartTime = dbStartTime;
          effectiveDuration = end_time - effectiveStartTime;
        }
      }
    } catch (fetchError) {
      console.log('[云函数] 获取会话记录失败，使用传入的数据:', fetchError);
    }
    
    // 确保duration不小于0
    if (effectiveDuration < 0) {
      console.warn('[云函数] duration为负数，重置为0:', effectiveDuration);
      effectiveDuration = 0;
    }
    
    // 使用 set 方法，如果文档不存在则创建，存在则覆盖
    await db.collection('user_sessions').doc(session_id).set({
      data: {
        session_id: session_id,
        user_id: user_id,
        group: group,
        start_time: effectiveStartTime,
        end_time: end_time,
        duration: effectiveDuration,
        status: status,
        has_skip: has_skip,
        exit_question_index: exit_question_index,
        exit_count: exit_count,           // 新增：退出次数
        last_exit_time: last_exit_time,   // 新增：上次退出时间
        created_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    });

    console.log('[云函数] 会话结束记录成功:', {
      session_id,
      effectiveStartTime,
      end_time,
      effectiveDuration,
      status
    });
    
    return { success: true };
  } catch (error) {
    console.error('记录会话结束失败：', error);
    return { success: false, message: error.message };
  }
}

/**
 * 处理LLM交互日志
 */
async function handleLLMInteraction(data) {
  const {
    session_id,
    event_type,
    user_action
  } = data;

  try {
    const interactionId = `llm_${session_id}_${Date.now()}`;

    await db.collection('llm_interactions').doc(interactionId).set({
      data: {
        session_id: session_id,
        event_type: event_type,
        user_action: user_action,
        created_at: db.serverDate()
      }
    });

    return { success: true, interaction_id: interactionId };
  } catch (error) {
    console.error('记录LLM交互失败：', error);
    return { success: false, message: error.message };
  }
}

// 导出主函数
exports.main = main;
