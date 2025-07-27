const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 17924;
const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gpt-3.5-turbo';

app.use(cors());
app.use(express.json());

let cachedModels = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

function generateModelMetadata(modelId) {
    const sizeMap = {
        'gpt-4': { size: 8500000000, param: '175B', quant: 'Q4_K_M' },
        'gpt-4-turbo': { size: 7200000000, param: '175B', quant: 'Q4_K_M' },
        'gpt-3.5-turbo': { size: 4200000000, param: '20B', quant: 'Q4_K_M' },
        'gpt-4o': { size: 6800000000, param: '175B', quant: 'Q4_K_M' },
        'gpt-4o-mini': { size: 2100000000, param: '8B', quant: 'Q4_K_M' },
        'claude': { size: 5500000000, param: '70B', quant: 'Q4_K_M' },
        'gemini': { size: 4800000000, param: '30B', quant: 'Q4_K_M' }
    };
    
    let metadata = sizeMap[modelId];
    if (!metadata) {
        const hash = modelId.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
        const sizes = [2100000000, 4200000000, 6800000000, 8500000000];
        const params = ['8B', '20B', '70B', '175B'];
        const idx = Math.abs(hash) % sizes.length;
        metadata = { size: sizes[idx], param: params[idx], quant: 'Q4_K_M' };
    }
    
    return metadata;
}

async function fetchOpenAIModels() {
    const now = Date.now();
    if (cachedModels && (now - lastFetchTime) < CACHE_DURATION) {
        return cachedModels;
    }
    
    try {
        console.log('Fetching model list from OpenAI API...');
        const response = await axios.get(`${OPENAI_API_URL}/models`, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const models = response.data.data.map(model => {
            const metadata = generateModelMetadata(model.id);
            
            return {
                name: model.id,
                model: model.id,
                modified_at: new Date(model.created * 1000).toISOString(),
                size: metadata.size,
                digest: `${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
                details: {
                    parent_model: "",
                    format: "gguf",
                    family: "llama",
                    families: ["llama"],
                    parameter_size: metadata.param,
                    quantization_level: metadata.quant
                }
            };
        });
        
        cachedModels = { models };
        lastFetchTime = now;
        console.log(`Fetched ${models.length} models from OpenAI API`);
        
        return cachedModels;
    } catch (error) {
        console.error('Failed to fetch models from OpenAI API:', error.response?.data || error.message);
        
        if (cachedModels) {
            console.log('Using cached model list');
            return cachedModels;
        }
        
        const metadata = generateModelMetadata(DEFAULT_MODEL);
        return {
            models: [{
                name: DEFAULT_MODEL,
                model: DEFAULT_MODEL,
                modified_at: new Date().toISOString(),
                size: metadata.size,
                digest: "fallback123456789abcdef",
                details: {
                    parent_model: "",
                    format: "gguf",
                    family: "llama",
                    families: ["llama"],
                    parameter_size: metadata.param,
                    quantization_level: metadata.quant
                }
            }]
        };
    }
}

function convertOpenAIToOllamaChat(openaiResponse, model, isStreaming = false) {
    const choice = openaiResponse.choices[0];
    
    if (isStreaming) {
        return {
            model: model,
            created_at: new Date().toISOString(),
            message: {
                role: choice.message.role,
                content: choice.message.content
            },
            done: false
        };
    }
    
    return {
        model: model,
        created_at: new Date().toISOString(),
        message: {
            role: choice.message.role,
            content: choice.message.content
        },
        done: true,
        done_reason: "stop",
        total_duration: Math.floor(Math.random() * 1000000000) + 500000000,
        load_duration: Math.floor(Math.random() * 10000000) + 1000000,
        prompt_eval_count: openaiResponse.usage?.prompt_tokens || 0,
        prompt_eval_duration: Math.floor(Math.random() * 100000000) + 50000000,
        eval_count: openaiResponse.usage?.completion_tokens || 0,
        eval_duration: Math.floor(Math.random() * 500000000) + 200000000
    };
}

function convertOpenAIToOllamaGenerate(openaiResponse, model, isStreaming = false) {
    const choice = openaiResponse.choices[0];
    
    if (isStreaming) {
        return {
            model: model,
            created_at: new Date().toISOString(),
            response: choice.message.content,
            done: false
        };
    }
    
    return {
        model: model,
        created_at: new Date().toISOString(),
        response: choice.message.content,
        done: true,
        done_reason: "stop",
        context: [],
        total_duration: Math.floor(Math.random() * 1000000000) + 500000000,
        load_duration: Math.floor(Math.random() * 10000000) + 1000000,
        prompt_eval_count: openaiResponse.usage?.prompt_tokens || 0,
        prompt_eval_duration: Math.floor(Math.random() * 100000000) + 50000000,
        eval_count: openaiResponse.usage?.completion_tokens || 0,
        eval_duration: Math.floor(Math.random() * 500000000) + 200000000
    };
}

function convertOllamaGenerateToOpenAI(ollamaRequest) {
    const messages = [];
    
    if (ollamaRequest.system) {
        messages.push({ role: 'system', content: ollamaRequest.system });
    }
    
    if (ollamaRequest.prompt) {
        messages.push({ role: 'user', content: ollamaRequest.prompt });
    }
    
    return {
        model: ollamaRequest.model || DEFAULT_MODEL,
        messages: messages,
        stream: ollamaRequest.stream || false,
        temperature: ollamaRequest.options?.temperature || 0.7,
        max_tokens: ollamaRequest.options?.num_predict || 2048
    };
}

function convertOllamaToOpenAI(ollamaRequest) {
    const messages = ollamaRequest.messages || [
        { role: 'user', content: ollamaRequest.prompt || '' }
    ];
    
    return {
        model: ollamaRequest.model || DEFAULT_MODEL,
        messages: messages,
        stream: ollamaRequest.stream || false,
        temperature: ollamaRequest.options?.temperature || 0.7,
        max_tokens: ollamaRequest.options?.num_predict || 2048
    };
}

app.post('/api/chat', async (req, res) => {
    try {
        const ollamaRequest = req.body;
        console.log(`[${new Date().toISOString()}] Raw chat request:`, JSON.stringify(ollamaRequest, null, 2));
        
        const openaiRequest = convertOllamaToOpenAI(ollamaRequest);
        const isStreaming = ollamaRequest.stream !== false;
        openaiRequest.stream = isStreaming;
        
        console.log(`[${new Date().toISOString()}] Converted to OpenAI format:`, JSON.stringify(openaiRequest, null, 2));
        
        if (isStreaming) {
            res.setHeader('Content-Type', 'application/x-ndjson');
            res.setHeader('Transfer-Encoding', 'chunked');
            
            const response = await axios.post(`${OPENAI_API_URL}/chat/completions`, openaiRequest, {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'stream'
            });
            
            let fullContent = '';
            let totalTokens = 0;
            
            response.data.on('data', (chunk) => {
                const lines = chunk.toString().split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            const finalResponse = {
                                model: openaiRequest.model,
                                created_at: new Date().toISOString(),
                                message: {
                                    role: 'assistant',
                                    content: ''
                                },
                                done: true,
                                done_reason: 'stop',
                                total_duration: Math.floor(Math.random() * 1000000000) + 500000000,
                                load_duration: Math.floor(Math.random() * 10000000) + 1000000,
                                prompt_eval_count: Math.floor(totalTokens * 0.3),
                                prompt_eval_duration: Math.floor(Math.random() * 100000000) + 50000000,
                                eval_count: totalTokens,
                                eval_duration: Math.floor(Math.random() * 500000000) + 200000000
                            };
                            res.write(JSON.stringify(finalResponse) + '\n');
                            res.end();
                            return;
                        }
                        
                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices?.[0]?.delta;
                            
                            if (delta?.content) {
                                fullContent += delta.content;
                                totalTokens++;
                                
                                const ollamaChunk = {
                                    model: openaiRequest.model,
                                    created_at: new Date().toISOString(),
                                    message: {
                                        role: 'assistant',
                                        content: delta.content
                                    },
                                    done: false
                                };
                                
                                res.write(JSON.stringify(ollamaChunk) + '\n');
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            });
            
            response.data.on('error', (error) => {
                console.error('Stream error:', error);
                res.status(500).json({ error: error.message });
            });
            
        } else {
            const response = await axios.post(`${OPENAI_API_URL}/chat/completions`, openaiRequest, {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const ollamaResponse = convertOpenAIToOllamaChat(response.data, openaiRequest.model);
            res.json(ollamaResponse);
        }
        
        console.log(`[${new Date().toISOString()}] Response sent for model: ${openaiRequest.model}`);
        
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Chat error:`, error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error?.message || error.message
        });
    }
});

app.post('/api/generate', async (req, res) => {
    try {
        const ollamaRequest = req.body;
        console.log(`[${new Date().toISOString()}] Raw generate request:`, JSON.stringify(ollamaRequest, null, 2));
        
        const openaiRequest = convertOllamaGenerateToOpenAI(ollamaRequest);
        const isStreaming = ollamaRequest.stream !== false;
        openaiRequest.stream = isStreaming;
        
        console.log(`[${new Date().toISOString()}] Converted to OpenAI format:`, JSON.stringify(openaiRequest, null, 2));
        
        if (isStreaming) {
            res.setHeader('Content-Type', 'application/x-ndjson');
            res.setHeader('Transfer-Encoding', 'chunked');
            
            const response = await axios.post(`${OPENAI_API_URL}/chat/completions`, openaiRequest, {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'stream'
            });
            
            let fullContent = '';
            let totalTokens = 0;
            
            response.data.on('data', (chunk) => {
                const lines = chunk.toString().split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            const finalResponse = {
                                model: openaiRequest.model,
                                created_at: new Date().toISOString(),
                                response: '',
                                done: true,
                                done_reason: 'stop',
                                context: [],
                                total_duration: Math.floor(Math.random() * 1000000000) + 500000000,
                                load_duration: Math.floor(Math.random() * 10000000) + 1000000,
                                prompt_eval_count: Math.floor(totalTokens * 0.3),
                                prompt_eval_duration: Math.floor(Math.random() * 100000000) + 50000000,
                                eval_count: totalTokens,
                                eval_duration: Math.floor(Math.random() * 500000000) + 200000000
                            };
                            res.write(JSON.stringify(finalResponse) + '\n');
                            res.end();
                            return;
                        }
                        
                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices?.[0]?.delta;
                            
                            if (delta?.content) {
                                fullContent += delta.content;
                                totalTokens++;
                                
                                const ollamaChunk = {
                                    model: openaiRequest.model,
                                    created_at: new Date().toISOString(),
                                    response: delta.content,
                                    done: false
                                };
                                
                                res.write(JSON.stringify(ollamaChunk) + '\n');
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            });
            
            response.data.on('error', (error) => {
                console.error('Stream error:', error);
                res.status(500).json({ error: error.message });
            });
            
        } else {
            const response = await axios.post(`${OPENAI_API_URL}/chat/completions`, openaiRequest, {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const ollamaResponse = convertOpenAIToOllamaGenerate(response.data, openaiRequest.model);
            res.json(ollamaResponse);
        }
        
        console.log(`[${new Date().toISOString()}] Response sent for model: ${openaiRequest.model}`);
        
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Generate error:`, error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error?.message || error.message
        });
    }
});

app.get('/api/tags', async (req, res) => {
    try {
        console.log(`[${new Date().toISOString()}] Tags request received`);
        
        const models = await fetchOpenAIModels();
        console.log(`[${new Date().toISOString()}] Returning ${models.models.length} models`);
        
        res.set('Content-Type', 'application/json');
        res.status(200).json(models);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Tags error:`, error.message);
        res.status(500).json({
            error: 'Failed to fetch model list'
        });
    }
});

app.post('/api/show', async (req, res) => {
    try {
        const { model } = req.body;
        console.log(`[${new Date().toISOString()}] Show request for model: ${model}`);
        
        res.json({
            modelfile: `# Modelfile for ${model}\nFROM ${model}`,
            parameters: "temperature 0.7\nnum_ctx 4096",
            template: "{{ .System }}{{ .Prompt }}",
            details: {
                parent_model: "",
                format: "gguf",
                family: "gpt",
                families: ["gpt"],
                parameter_size: "unknown",
                quantization_level: "unknown"
            }
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Show error:`, error.message);
        res.status(500).json({
            error: 'Failed to get model info'
        });
    }
});

app.get('/api/ps', (req, res) => {
    console.log(`[${new Date().toISOString()}] PS request received`);
    
    res.set('Content-Type', 'application/json');
    res.status(200).json({
        models: []
    });
});

app.get('/api/version', (req, res) => {
    console.log(`[${new Date().toISOString()}] Version request received`);
    
    res.set('Content-Type', 'application/json');
    res.status(200).json({
        version: "0.1.88"
    });
});

app.get('/', (req, res) => {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send('Ollama is running');
});

app.get('/api', (req, res) => {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send('Ollama is running');
});

app.listen(PORT, () => {
    console.log(`OpenAI to Ollama proxy server running on http://localhost:${PORT}`);
    console.log(`Proxying to: ${OPENAI_API_URL}`);
    console.log(`Default model: ${DEFAULT_MODEL}`);
});