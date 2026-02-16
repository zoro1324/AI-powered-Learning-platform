"""
Management command to seed the database with 30 popular courses
Usage: python manage.py seed_courses [--clear]
"""

from django.core.management.base import BaseCommand
from api.models import Course


class Command(BaseCommand):
    help = 'Seeds the database with 30 popular courses across various categories'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete all existing courses before seeding',
        )

    def handle(self, *args, **options):
        if options['clear']:
            count = Course.objects.count()
            Course.objects.all().delete()
            self.stdout.write(
                self.style.WARNING(f'Deleted {count} existing courses')
            )

        courses_data = [
            # Web Development (8 courses)
            {
                'name': 'Full-Stack Web Development Bootcamp',
                'title': 'Full-Stack Web Development Bootcamp',
                'description': 'Master the complete web development stack from HTML/CSS to React, Node.js, and databases. Build real-world projects including e-commerce sites, social platforms, and RESTful APIs. Learn modern development practices, Git workflows, and deployment strategies.',
                'category': 'web_dev',
                'difficulty_level': 'beginner',
                'estimated_duration': 240,
                'thumbnail': 'https://images.unsplash.com/photo-1498050108023-c5249f4df085',
                'is_popular': True,
            },
            {
                'name': 'React Mastery: From Basics to Advanced',
                'title': 'React Mastery: From Basics to Advanced',
                'description': 'Deep dive into React ecosystem including hooks, context API, Redux for state management, React Router, and performance optimization. Build production-ready applications with testing using Jest and React Testing Library.',
                'category': 'web_dev',
                'difficulty_level': 'intermediate',
                'estimated_duration': 180,
                'thumbnail': 'https://images.unsplash.com/photo-1633356122544-f134324a6cee',
                'is_popular': True,
            },
            {
                'name': 'Modern JavaScript ES6+',
                'title': 'Modern JavaScript ES6+',
                'description': 'Learn modern JavaScript features including arrow functions, destructuring, spread operators, async/await, promises, and modules. Understand event loop, closures, prototypes, and functional programming concepts.',
                'category': 'web_dev',
                'difficulty_level': 'intermediate',
                'estimated_duration': 120,
                'thumbnail': 'https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a',
                'is_popular': True,
            },
            {
                'name': 'Node.js Backend Development',
                'title': 'Node.js Backend Development',
                'description': 'Build scalable backend services with Node.js and Express. Learn authentication with JWT, database integration with MongoDB and PostgreSQL, API design best practices, middleware, error handling, and security.',
                'category': 'web_dev',
                'difficulty_level': 'intermediate',
                'estimated_duration': 150,
                'thumbnail': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31',
                'is_popular': True,
            },
            {
                'name': 'Vue.js Complete Guide',
                'title': 'Vue.js Complete Guide',
                'description': 'Master Vue.js 3 composition API, Vuex for state management, Vue Router, and component design patterns. Build interactive single-page applications with modern tooling and best practices.',
                'category': 'web_dev',
                'difficulty_level': 'beginner',
                'estimated_duration': 140,
                'thumbnail': 'https://images.unsplash.com/photo-1587620962725-abab7fe55159',
                'is_popular': True,
            },
            {
                'name': 'TypeScript for Professionals',
                'title': 'TypeScript for Professionals',
                'description': 'Learn TypeScript from fundamentals to advanced features including generics, decorators, utility types, and integration with popular frameworks. Improve code quality and catch errors at compile time.',
                'category': 'web_dev',
                'difficulty_level': 'intermediate',
                'estimated_duration': 100,
                'thumbnail': 'https://images.unsplash.com/photo-1516116216624-53e697fedbea',
                'is_popular': True,
            },
            {
                'name': 'GraphQL API Development',
                'title': 'GraphQL API Development',
                'description': 'Build efficient APIs with GraphQL. Learn schema design, resolvers, queries, mutations, subscriptions, and integration with Apollo Client and Server. Compare REST vs GraphQL approaches.',
                'category': 'web_dev',
                'difficulty_level': 'advanced',
                'estimated_duration': 130,
                'thumbnail': 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb',
                'is_popular': True,
            },
            {
                'name': 'Web Performance Optimization',
                'title': 'Web Performance Optimization',
                'description': 'Master techniques to optimize web application performance including lazy loading, code splitting, caching strategies, image optimization, Core Web Vitals, and performance monitoring tools.',
                'category': 'web_dev',
                'difficulty_level': 'advanced',
                'estimated_duration': 110,
                'thumbnail': 'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
                'is_popular': True,
            },
            
            # Data Science (6 courses)
            {
                'name': 'Data Science Fundamentals',
                'title': 'Data Science Fundamentals',
                'description': 'Start your data science journey learning Python, NumPy, Pandas, and data visualization with Matplotlib and Seaborn. Explore exploratory data analysis, data cleaning, and statistical foundations.',
                'category': 'data_science',
                'difficulty_level': 'beginner',
                'estimated_duration': 200,
                'thumbnail': 'https://images.unsplash.com/photo-1551288049-bebda4e38f71',
                'is_popular': True,
            },
            {
                'name': 'Python for Data Analysis',
                'title': 'Python for Data Analysis',
                'description': 'Master Pandas for data manipulation, NumPy for numerical computing, and advanced data wrangling techniques. Work with real-world datasets and learn data cleaning best practices.',
                'category': 'data_science',
                'difficulty_level': 'intermediate',
                'estimated_duration': 160,
                'thumbnail': 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5',
                'is_popular': True,
            },
            {
                'name': 'Statistical Analysis with R',
                'title': 'Statistical Analysis with R',
                'description': 'Learn statistical modeling, hypothesis testing, regression analysis, and data visualization using R and ggplot2. Apply statistical methods to real-world business problems.',
                'category': 'data_science',
                'difficulty_level': 'intermediate',
                'estimated_duration': 170,
                'thumbnail': 'https://images.unsplash.com/photo-1543286386-713bdd548da4',
                'is_popular': True,
            },
            {
                'name': 'Data Visualization Masterclass',
                'title': 'Data Visualization Masterclass',
                'description': 'Create compelling data visualizations using Tableau, Power BI, and Python libraries. Learn design principles, storytelling with data, and interactive dashboard creation.',
                'category': 'data_science',
                'difficulty_level': 'beginner',
                'estimated_duration': 120,
                'thumbnail': 'https://images.unsplash.com/photo-1551288049-bebda4e38f71',
                'is_popular': True,
            },
            {
                'name': 'Big Data with Apache Spark',
                'title': 'Big Data with Apache Spark',
                'description': 'Process large-scale data with Apache Spark. Learn RDDs, DataFrames, Spark SQL, and streaming. Deploy Spark applications on cloud platforms and optimize performance.',
                'category': 'data_science',
                'difficulty_level': 'advanced',
                'estimated_duration': 190,
                'thumbnail': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31',
                'is_popular': True,
            },
            {
                'name': 'SQL for Data Analysis',
                'title': 'SQL for Data Analysis',
                'description': 'Master SQL queries, joins, subqueries, window functions, and CTEs. Learn database design, optimization, and advanced analytical queries for business intelligence.',
                'category': 'data_science',
                'difficulty_level': 'beginner',
                'estimated_duration': 100,
                'thumbnail': 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d',
                'is_popular': True,
            },
            
            # AI & Machine Learning (5 courses)
            {
                'name': 'Machine Learning A-Z',
                'title': 'Machine Learning A-Z',
                'description': 'Comprehensive machine learning course covering supervised and unsupervised learning, regression, classification, clustering, and model evaluation. Use scikit-learn and TensorFlow for hands-on projects.',
                'category': 'ai_ml',
                'difficulty_level': 'intermediate',
                'estimated_duration': 260,
                'thumbnail': 'https://images.unsplash.com/photo-1555949963-aa79dcee981c',
                'is_popular': True,
            },
            {
                'name': 'Deep Learning with PyTorch',
                'title': 'Deep Learning with PyTorch',
                'description': 'Build neural networks with PyTorch including CNNs for computer vision, RNNs for sequence data, and transfer learning. Implement state-of-the-art architectures and deploy models.',
                'category': 'ai_ml',
                'difficulty_level': 'advanced',
                'estimated_duration': 220,
                'thumbnail': 'https://images.unsplash.com/photo-1677442136019-21780ecad995',
                'is_popular': True,
            },
            {
                'name': 'Natural Language Processing',
                'title': 'Natural Language Processing',
                'description': 'Master NLP techniques including text preprocessing, sentiment analysis, named entity recognition, and language models. Work with BERT, GPT, and transformer architectures.',
                'category': 'ai_ml',
                'difficulty_level': 'advanced',
                'estimated_duration': 200,
                'thumbnail': 'https://images.unsplash.com/photo-1676277791608-ac5369f37207',
                'is_popular': True,
            },
            {
                'name': 'Computer Vision Essentials',
                'title': 'Computer Vision Essentials',
                'description': 'Learn image processing, object detection, facial recognition, and image segmentation using OpenCV and deep learning. Build applications like face filters and autonomous vehicle perception.',
                'category': 'ai_ml',
                'difficulty_level': 'intermediate',
                'estimated_duration': 180,
                'thumbnail': 'https://images.unsplash.com/photo-1535378917042-10a22c95931a',
                'is_popular': True,
            },
            {
                'name': 'AI Ethics and Responsible AI',
                'title': 'AI Ethics and Responsible AI',
                'description': 'Understand ethical implications of AI, bias in machine learning, fairness, transparency, and privacy. Learn frameworks for responsible AI development and deployment.',
                'category': 'ai_ml',
                'difficulty_level': 'beginner',
                'estimated_duration': 80,
                'thumbnail': 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485',
                'is_popular': True,
            },
            
            # Mobile Development (4 courses)
            {
                'name': 'iOS Development with Swift',
                'title': 'iOS Development with Swift',
                'description': 'Build native iOS applications using Swift and SwiftUI. Learn iOS design patterns, Core Data, networking, push notifications, and App Store deployment.',
                'category': 'mobile_dev',
                'difficulty_level': 'beginner',
                'estimated_duration': 190,
                'thumbnail': 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c',
                'is_popular': True,
            },
            {
                'name': 'Android Development with Kotlin',
                'title': 'Android Development with Kotlin',
                'description': 'Create Android apps using Kotlin and Jetpack Compose. Master Material Design, Room database, MVVM architecture, and Google Play Store publishing.',
                'category': 'mobile_dev',
                'difficulty_level': 'beginner',
                'estimated_duration': 200,
                'thumbnail': 'https://images.unsplash.com/photo-1607252650355-f7fd0460ccdb',
                'is_popular': True,
            },
            {
                'name': 'React Native Cross-Platform Apps',
                'title': 'React Native Cross-Platform Apps',
                'description': 'Build iOS and Android apps with a single codebase using React Native. Learn navigation, state management, native modules, and performance optimization.',
                'category': 'mobile_dev',
                'difficulty_level': 'intermediate',
                'estimated_duration': 170,
                'thumbnail': 'https://images.unsplash.com/photo-1551650975-87deedd944c3',
                'is_popular': True,
            },
            {
                'name': 'Flutter Development Complete',
                'title': 'Flutter Development Complete',
                'description': 'Master Flutter and Dart to create beautiful cross-platform mobile applications. Learn widgets, animations, state management with Provider and Bloc, and Firebase integration.',
                'category': 'mobile_dev',
                'difficulty_level': 'intermediate',
                'estimated_duration': 180,
                'thumbnail': 'https://images.unsplash.com/photo-1618761714954-0b8cd0026356',
                'is_popular': True,
            },
            
            # Cloud Computing (3 courses)
            {
                'name': 'AWS Cloud Practitioner',
                'title': 'AWS Cloud Practitioner',
                'description': 'Master Amazon Web Services fundamentals including EC2, S3, RDS, Lambda, and CloudFormation. Learn cloud architecture, security best practices, and cost optimization.',
                'category': 'cloud',
                'difficulty_level': 'beginner',
                'estimated_duration': 150,
                'thumbnail': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa',
                'is_popular': True,
            },
            {
                'name': 'Docker and Kubernetes Mastery',
                'title': 'Docker and Kubernetes Mastery',
                'description': 'Learn containerization with Docker and orchestration with Kubernetes. Build microservices, manage deployments, scaling, and service discovery in production environments.',
                'category': 'cloud',
                'difficulty_level': 'intermediate',
                'estimated_duration': 140,
                'thumbnail': 'https://images.unsplash.com/photo-1605745341112-85968b19335b',
                'is_popular': True,
            },
            {
                'name': 'Azure Cloud Solutions Architect',
                'title': 'Azure Cloud Solutions Architect',
                'description': 'Design and implement Microsoft Azure solutions. Learn Azure services, networking, security, identity management, and hybrid cloud architectures for enterprise applications.',
                'category': 'cloud',
                'difficulty_level': 'advanced',
                'estimated_duration': 180,
                'thumbnail': 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8',
                'is_popular': True,
            },
            
            # Design (2 courses)
            {
                'name': 'UI/UX Design Fundamentals',
                'title': 'UI/UX Design Fundamentals',
                'description': 'Learn user interface and user experience design principles. Master Figma, conduct user research, create wireframes and prototypes, and perform usability testing.',
                'category': 'design',
                'difficulty_level': 'beginner',
                'estimated_duration': 130,
                'thumbnail': 'https://images.unsplash.com/photo-1561070791-2526d30994b5',
                'is_popular': True,
            },
            {
                'name': 'Advanced Figma for Designers',
                'title': 'Advanced Figma for Designers',
                'description': 'Master advanced Figma techniques including auto-layout, components, variants, interactive prototypes, and design systems. Collaborate effectively with development teams.',
                'category': 'design',
                'difficulty_level': 'intermediate',
                'estimated_duration': 100,
                'thumbnail': 'https://images.unsplash.com/photo-1626785774573-4b799315345d',
                'is_popular': True,
            },
            
            # DevOps (2 courses)
            {
                'name': 'DevOps Engineering Bootcamp',
                'title': 'DevOps Engineering Bootcamp',
                'description': 'Master CI/CD pipelines with Jenkins and GitHub Actions, infrastructure as code with Terraform, monitoring with Prometheus and Grafana, and automation best practices.',
                'category': 'devops',
                'difficulty_level': 'intermediate',
                'estimated_duration': 170,
                'thumbnail': 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb',
                'is_popular': True,
            },
            {
                'name': 'Site Reliability Engineering',
                'title': 'Site Reliability Engineering',
                'description': 'Learn SRE principles, incident management, post-mortems, monitoring, alerting, and building reliable distributed systems. Understand SLI, SLO, and error budgets.',
                'category': 'devops',
                'difficulty_level': 'advanced',
                'estimated_duration': 160,
                'thumbnail': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31',
                'is_popular': True,
            },
        ]

        created_count = 0
        for course_data in courses_data:
            course, created = Course.objects.get_or_create(
                title=course_data['title'],
                defaults=course_data
            )
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Created: {course.title}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'- Already exists: {course.title}')
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'\n🎉 Successfully seeded {created_count} new courses! Total: {Course.objects.count()}'
            )
        )
