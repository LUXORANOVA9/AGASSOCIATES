"""
Embedding generator script for legal templates
Generates vector embeddings for template content and stores them in PostgreSQL
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer
from config import get_database_url, EMBEDDING_MODEL_NAME, EMBEDDING_DIMENSION

def generate_embeddings():
    """Generate embeddings for all templates without embeddings"""
    
    # Load embedding model
    print(f"Loading embedding model: {EMBEDDING_MODEL_NAME}")
    model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    
    # Connect to database
    print("Connecting to database...")
    conn = psycopg2.connect(get_database_url(), cursor_factory=RealDictCursor)
    register_vector(conn)
    cur = conn.cursor()
    
    # Fetch templates without embeddings
    print("Fetching templates without embeddings...")
    cur.execute("""
        SELECT id, title, content, language 
        FROM legal_templates 
        WHERE embedding IS NULL
    """)
    
    templates = cur.fetchall()
    print(f"Found {len(templates)} templates to process")
    
    processed_count = 0
    for template in templates:
        template_id = template['id']
        content = template['content']
        title = template['title']
        
        print(f"Processing template #{template_id}: {title}")
        
        # Generate embedding
        embedding = model.encode(content)
        
        # Ensure embedding dimension matches
        if len(embedding) != EMBEDDING_DIMENSION:
            print(f"Warning: Embedding dimension mismatch. Expected {EMBEDDING_DIMENSION}, got {len(embedding)}")
            # Resize if necessary (for demo purposes)
            if len(embedding) > EMBEDDING_DIMENSION:
                embedding = embedding[:EMBEDDING_DIMENSION]
            else:
                import numpy as np
                embedding = np.pad(embedding, (0, EMBEDDING_DIMENSION - len(embedding)))
        
        # Convert to list for PostgreSQL
        embedding_list = embedding.tolist()
        
        # Update database
        cur.execute("""
            UPDATE legal_templates 
            SET embedding = %s::vector 
            WHERE id = %s
        """, (embedding_list, template_id))
        
        processed_count += 1
        print(f"✓ Updated embedding for template #{template_id}")
    
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"\n✅ Successfully processed {processed_count} templates")
    return processed_count

if __name__ == "__main__":
    try:
        count = generate_embeddings()
        print(f"\nEmbedding generation complete! {count} templates processed.")
    except Exception as e:
        print(f"❌ Error generating embeddings: {str(e)}")
        raise
