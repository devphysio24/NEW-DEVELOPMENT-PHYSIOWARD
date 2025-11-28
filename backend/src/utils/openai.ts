/**
 * OpenAI API Utility - Optimized for Cost Efficiency
 * Uses GPT-3.5-turbo for cost-effective analysis
 */

interface AnalyzeIncidentParams {
  type: 'incident' | 'near_miss'
  description: string
  location: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  date: string
  imageBase64?: string // Optional base64 encoded image for vision analysis
  imageMimeType?: string // e.g., 'image/jpeg', 'image/png'
}

interface AnalysisResult {
  summary: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  recommendations: string[]
  severityAssessment: string
  followUpActions: string[]
  advice: string // Advice/suggestions based on description
}

interface AnalyzeTranscriptionParams {
  transcription: string
  context?: string // Optional context (e.g., case number, worker name)
}

interface TranscriptionAnalysisResult {
  summary: string
  keyPoints: string[]
  clinicalNotes: string
  recommendations: string[]
  actionItems: string[]
}

/**
 * Calculate GPT-3.5-turbo cost from token usage
 * Pricing (as of 2024): Input $0.50/1M tokens, Output $1.50/1M tokens
 */
function calculateGpt35TurboCost(usage: { prompt_tokens?: number; completion_tokens?: number } | undefined): {
  cost: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
} {
  const inputTokens = usage?.prompt_tokens || 0
  const outputTokens = usage?.completion_tokens || 0
  const inputCost = (inputTokens / 1_000_000) * 0.50
  const outputCost = (outputTokens / 1_000_000) * 1.50
  const totalCost = inputCost + outputCost

  return {
    cost: totalCost,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  }
}

/**
 * Calculate GPT-4o-mini cost from token usage (for vision)
 * Pricing (as of 2024): Input $0.15/1K tokens, Output $0.60/1K tokens
 */
function calculateGpt4oMiniCost(usage: { prompt_tokens?: number; completion_tokens?: number } | undefined): {
  cost: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
} {
  const inputTokens = usage?.prompt_tokens || 0
  const outputTokens = usage?.completion_tokens || 0
  const inputCost = (inputTokens / 1_000) * 0.00015
  const outputCost = (outputTokens / 1_000) * 0.0006
  const totalCost = inputCost + outputCost

  return {
    cost: totalCost,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  }
}

/**
 * Analyze incident report using OpenAI API
 * Supports both text-only and image+text analysis
 * Uses GPT-4o-mini for vision (when image provided), GPT-3.5-turbo for text-only
 */
export async function analyzeIncident(params: AnalyzeIncidentParams): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  // Import OpenAI dynamically to avoid issues if package not installed
  const { OpenAI } = await import('openai')
  const openai = new OpenAI({ apiKey })

  const hasImage = params.imageBase64 && params.imageMimeType

  // Optimized prompt - concise to minimize tokens
  const systemPrompt = `You are an expert clinician specializing in workplace safety and occupational health. Analyze incident reports from a medical and clinical perspective.${hasImage ? ' You will also analyze the provided image of the incident scene or injury.' : ''} Provide professional clinical advice, assessment, and recommendations. Respond in JSON format:
{
  "summary": "Brief 2-sentence clinical summary${hasImage ? ' including observations from the image' : ''}",
  "riskLevel": "low|medium|high|critical",
  "recommendations": ["3-4 brief clinical recommendations"],
  "severityAssessment": "One sentence clinical assessment of severity${hasImage ? ' based on both description and image' : ''}",
  "followUpActions": ["2-3 specific clinical follow-up actions"],
  "advice": "Expert clinician advice and medical recommendations (2-3 sentences)"${hasImage ? ',\n  "imageAnalysis": "Detailed analysis of what is visible in the image (2-3 sentences)"' : ''}
}`

  const userPromptText = `As an expert clinician, analyze this workplace incident report:

Report Type: ${params.type === 'incident' ? 'Incident' : 'Near-Miss'}
Severity: ${params.severity.toUpperCase()}
Date: ${params.date}
Location: ${params.location}
Description: ${params.description}

${hasImage ? 'I have also attached a photo of the incident scene/injury. Please analyze the image and include your observations in your assessment.' : ''}

Provide your clinical assessment, medical recommendations, and professional advice.`

  try {
    let completion: any
    let costData: { cost: number; inputTokens: number; outputTokens: number; totalTokens: number }

    if (hasImage) {
      // Use GPT-4o-mini for vision analysis (supports images)
      console.log('[analyzeIncident] Using GPT-4o-mini for image analysis')
      
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: [
            { type: 'text', text: userPromptText },
            { 
              type: 'image_url', 
              image_url: { 
                url: `data:${params.imageMimeType};base64,${params.imageBase64}`,
                detail: 'low' // Use low detail to reduce cost
              } 
            }
          ]
        }
      ]

      completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Vision-capable model
        messages,
        temperature: 0.3,
        max_tokens: 700,
      })

      costData = calculateGpt4oMiniCost(completion.usage)
    } else {
      // Use GPT-3.5-turbo for text-only analysis (cost-effective)
      completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPromptText }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      })

      costData = calculateGpt35TurboCost(completion.usage)
    }

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    // Log cost for debugging
    if (costData.cost > 0.0001) {
      console.log(`[analyzeIncident] Cost: $${costData.cost.toFixed(6)} (${costData.inputTokens} input + ${costData.outputTokens} output tokens)${hasImage ? ' [with image]' : ''}`)
    }

    // Parse JSON response (handle potential markdown code blocks from vision model)
    let jsonContent = content.trim()
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.slice(7)
    }
    if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.slice(3)
    }
    if (jsonContent.endsWith('```')) {
      jsonContent = jsonContent.slice(0, -3)
    }
    jsonContent = jsonContent.trim()

    const analysis = JSON.parse(jsonContent) as AnalysisResult & { imageAnalysis?: string }
    
    // Attach cost and image analysis to result
    ;(analysis as any).estimatedCost = costData.cost
    ;(analysis as any).tokenUsage = {
      input: costData.inputTokens,
      output: costData.outputTokens,
      total: costData.totalTokens
    }
    ;(analysis as any).hasImageAnalysis = hasImage

    // Validate and sanitize response
    const result: AnalysisResult = {
      summary: analysis.summary || 'Analysis completed',
      riskLevel: ['low', 'medium', 'high', 'critical'].includes(analysis.riskLevel?.toLowerCase())
        ? analysis.riskLevel.toLowerCase() as 'low' | 'medium' | 'high' | 'critical'
        : params.severity,
      recommendations: Array.isArray(analysis.recommendations) 
        ? analysis.recommendations.slice(0, 4)
        : ['Conduct clinical assessment with healthcare provider', 'Monitor for signs of injury or complications', 'Follow workplace safety protocols'],
      severityAssessment: analysis.severityAssessment || 'Clinical assessment pending - please review severity classification',
      followUpActions: Array.isArray(analysis.followUpActions)
        ? analysis.followUpActions.slice(0, 3)
        : ['Notify clinical supervisor', 'Document incident for medical review', 'Monitor worker condition'],
      advice: analysis.advice || 'As a clinician, I recommend immediate medical evaluation if any injuries are present. Ensure proper documentation for clinical follow-up.'
    }

    // Add image analysis if available
    if (analysis.imageAnalysis) {
      ;(result as any).imageAnalysis = analysis.imageAnalysis
    }

    return result
  } catch (error: any) {
    console.error('[OpenAI Analysis] Error:', error)
    
    // Return fallback analysis if API fails
    return {
      summary: 'Unable to complete clinical analysis. Please have a clinician review the incident manually.',
      riskLevel: params.severity,
      recommendations: [
        'Schedule clinical assessment with healthcare provider',
        'Monitor for any signs of injury or complications',
        'Ensure all safety protocols were followed',
        'Document incident for medical review'
      ],
      severityAssessment: `Clinical assessment needed - Reported severity: ${params.severity.toUpperCase()}`,
      followUpActions: [
        'Notify clinical supervisor immediately',
        'Complete incident documentation for medical review',
        'Schedule follow-up clinical assessment'
      ],
      advice: 'As a clinician, I recommend immediate medical evaluation if any injuries occurred. Ensure proper clinical documentation and follow workplace safety protocols.'
    }
  }
}

/**
 * Transcribe audio using OpenAI Whisper API
 * @param audioFile - Audio file buffer or File object
 * @returns Transcribed text
 */
export async function transcribeAudio(audioFile: File | Buffer | Blob): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const { OpenAI } = await import('openai')
  const openai = new OpenAI({ apiKey })

  try {
    // Handle different input types and convert to Buffer for OpenAI SDK
    // OpenAI SDK for Node.js works best with File objects that have proper metadata
    let fileData: Buffer
    let fileName: string = 'audio.webm'
    let mimeType: string = 'audio/webm'
    
    if (Buffer.isBuffer(audioFile)) {
      // Already a Buffer
      fileData = audioFile
    } else if (audioFile && typeof audioFile === 'object' && 'arrayBuffer' in audioFile) {
      // Handle Blob or File objects
      const blob = audioFile as Blob | File
      const arrayBuffer = await blob.arrayBuffer()
      fileData = Buffer.from(arrayBuffer)
      
      if ('name' in blob && blob.name) {
        // It's a File object
        fileName = blob.name
        mimeType = blob.type || mimeType
      } else {
        // It's a Blob
        mimeType = blob.type || mimeType
        // Extract extension from mime type
        const ext = mimeType.split('/')[1] || 'webm'
        fileName = `audio.${ext}`
      }
    } else {
      throw new Error('Invalid audio file type')
    }

    // For Node.js, OpenAI SDK accepts File object or Buffer
    // Create a File object with proper metadata for the SDK
    // Note: OpenAI SDK for Node.js expects File objects with proper name and type
    const fileToUpload = new File([fileData], fileName, { 
      type: mimeType,
      lastModified: Date.now()
    })

    // Ensure the file has the correct properties for OpenAI SDK
    // The SDK will create multipart form data from the File object
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: fileToUpload,
      model: 'whisper-1',
      language: 'en', // Optional: specify language for better accuracy
      response_format: 'text'
    })

    // Handle response format - can be string or object with text property
    if (typeof transcriptionResponse === 'string') {
      return transcriptionResponse
    } else if (transcriptionResponse && typeof transcriptionResponse === 'object') {
      const response = transcriptionResponse as { text?: string }
      return response.text || String(transcriptionResponse)
    } else {
      return String(transcriptionResponse)
    }
  } catch (error: any) {
    console.error('[Whisper Transcription] Error:', error)
    throw new Error(`Transcription failed: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Analyze transcription using OpenAI GPT
 * Optimized for clinical notes and assessments
 */
export async function analyzeTranscription(params: AnalyzeTranscriptionParams): Promise<TranscriptionAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const { OpenAI } = await import('openai')
  const openai = new OpenAI({ apiKey })

  const systemPrompt = `You are an expert clinician specializing in workplace safety and occupational health. Analyze clinical notes and patient conversations from a medical perspective. Extract key information, provide clinical insights, and suggest actionable recommendations. Respond in JSON format:
{
  "summary": "Brief 2-3 sentence summary of the conversation",
  "keyPoints": ["3-5 key points or findings"],
  "clinicalNotes": "Detailed clinical notes and observations (2-3 sentences)",
  "recommendations": ["3-4 clinical recommendations"],
  "actionItems": ["2-3 specific action items for follow-up"]
}`

  const userPrompt = `As an expert clinician, analyze this clinical conversation transcription:
${params.context ? `Context: ${params.context}\n\n` : ''}Transcription:
${params.transcription}

Provide your clinical analysis, extract key medical information, and suggest recommendations.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Cost-effective model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    // Calculate cost from token usage
    const costData = calculateGpt35TurboCost(completion.usage)
    
    // Log cost for debugging (only if significant)
    if (costData.cost > 0.0001) {
      console.log(`[analyzeTranscription] Cost: $${costData.cost.toFixed(6)} (${costData.inputTokens} input + ${costData.outputTokens} output tokens)`)
    }

    const analysis = JSON.parse(content) as TranscriptionAnalysisResult
    
    // Attach cost to result for tracking
    ;(analysis as any).estimatedCost = costData.cost
    ;(analysis as any).tokenUsage = {
      input: costData.inputTokens,
      output: costData.outputTokens,
      total: costData.totalTokens
    }

    // Validate and sanitize response
    return {
      summary: analysis.summary || 'Analysis completed',
      keyPoints: Array.isArray(analysis.keyPoints) 
        ? analysis.keyPoints.slice(0, 5)
        : ['Review transcription for key clinical information'],
      clinicalNotes: analysis.clinicalNotes || 'Clinical notes extracted from conversation',
      recommendations: Array.isArray(analysis.recommendations)
        ? analysis.recommendations.slice(0, 4)
        : ['Review clinical notes', 'Schedule follow-up if needed', 'Document findings'],
      actionItems: Array.isArray(analysis.actionItems)
        ? analysis.actionItems.slice(0, 3)
        : ['Review transcription', 'Update clinical records', 'Schedule follow-up']
    }
  } catch (error: any) {
    console.error('[OpenAI Transcription Analysis] Error:', error)
    
    // Return fallback analysis
    return {
      summary: 'Unable to complete clinical analysis. Please review transcription manually.',
      keyPoints: ['Review transcription for key information'],
      clinicalNotes: 'Clinical notes require manual review',
      recommendations: [
        'Review transcription carefully',
        'Extract key clinical information',
        'Document findings in patient records'
      ],
      actionItems: [
        'Review transcription',
        'Update clinical records',
        'Schedule follow-up if needed'
      ]
    }
  }
}

