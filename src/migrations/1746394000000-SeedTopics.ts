import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedTopics1746394000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO topics (name, slug, description) VALUES
        ('React',         'react',         'Component-based UI library'),
        ('TypeScript',    'typescript',    'Typed JavaScript superset'),
        ('Docker',        'docker',        'Containerization platform'),
        ('Kubernetes',    'kubernetes',    'Container orchestration'),
        ('GraphQL',       'graphql',       'Query language for APIs'),
        ('Rust',          'rust',          'Systems programming language'),
        ('Python',        'python',        'Versatile scripting language'),
        ('AI/ML',         'ai-ml',         'Artificial intelligence and machine learning'),
        ('Security',      'security',      'Application and network security'),
        ('DevOps',        'devops',        'Development and operations practices'),
        ('System Design', 'system-design', 'Architecture and scalability'),
        ('Web APIs',      'web-apis',      'REST, gRPC, and API design')
      ON CONFLICT (slug) DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM topics WHERE slug IN (
        'react', 'typescript', 'docker', 'kubernetes', 'graphql',
        'rust', 'python', 'ai-ml', 'security', 'devops',
        'system-design', 'web-apis'
      )
    `);
  }
}
