const Fastify = require('fastify');
const multipart = require('@fastify/multipart');

async function testMultipart() {
  const fastify = Fastify({ logger: true });
  
  // Register multipart plugin
  await fastify.register(multipart, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 1024 * 1024, // 1MB
      fields: 20,
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 5,
      headerPairs: 2000,
      parts: 1000
    },
  });
  
  // Simple test route
  fastify.post('/test', async (request, reply) => {
    console.log('=== SIMPLE MULTIPART TEST ===');
    console.log('Content-Type:', request.headers['content-type']);
    console.log('Is multipart:', request.isMultipart());
    
    if (!request.isMultipart()) {
      return reply.code(400).send({ error: 'Not multipart' });
    }
    
    const formData = {};
    let partCount = 0;
    
    try {
      for await (const part of request.parts()) {
        partCount++;
        console.log(`Part ${partCount}:`, {
          fieldname: part.fieldname,
          filename: part.filename || 'N/A',
          type: part.type,
          mimetype: part.mimetype
        });
        
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          formData[part.fieldname] = {
            filename: part.filename || 'unknown',
            size: buffer.length,
            mimetype: part.mimetype
          };
        } else {
          formData[part.fieldname] = part.value;
        }
      }
      
      console.log(`Total parts: ${partCount}`);
      console.log('Form data:', formData);
      
      return { success: true, partCount, formData };
      
    } catch (error) {
      console.error('Error:', error);
      return reply.code(500).send({ error: error.message });
    }
  });
  
  await fastify.listen({ port: 3002, host: '0.0.0.0' });
  console.log('Test server running on http://localhost:3002');
}

testMultipart().catch(console.error);