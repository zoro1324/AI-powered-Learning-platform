"""
Management command to seed the database with individual sub-topics
Usage: python manage.py seed_courses [--clear]

This creates a platform focused on teaching individual sub-topics rather than full courses.
When users search for broad topics like "AI & ML", they'll be shown individual sub-topics to learn.
"""

from django.core.management.base import BaseCommand
from api.models import Course


class Command(BaseCommand):
    help = 'Seeds the database with individual learnable sub-topics across various categories'

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
                self.style.WARNING(f'Deleted {count} existing courses/topics')
            )

        # Define broad topics (not directly learnable)
        broad_topics = [
            {
                'name': 'AI & Machine Learning',
                'title': 'AI & Machine Learning',
                'description': 'This is a broad field. We can\'t teach you the entire topic, but we offer individual sub-topics you can learn one at a time. Browse the available sub-topics to start your learning journey.',
                'category': 'ai_ml',
                'is_sub_topic': False,
                'thumbnail': 'https://images.unsplash.com/photo-1555949963-aa79dcee981c',
            },
            {
                'name': 'Web Development',
                'title': 'Web Development',
                'description': 'Web development is a vast field. Choose from our individual sub-topics to learn specific technologies and skills.',
                'category': 'web_dev',
                'is_sub_topic': False,
                'thumbnail': 'https://images.unsplash.com/photo-1498050108023-c5249f4df085',
            },
            {
                'name': 'Data Science',
                'title': 'Data Science',
                'description': 'Data science covers many areas. Learn individual sub-topics to build your expertise step by step.',
                'category': 'data_science',
                'is_sub_topic': False,
                'thumbnail': 'https://images.unsplash.com/photo-1551288049-bebda4e38f71',
            },
            {
                'name': 'Mobile Development',
                'title': 'Mobile Development',
                'description': 'Mobile development spans multiple platforms and technologies. Choose specific sub-topics to master.',
                'category': 'mobile_dev',
                'is_sub_topic': False,
                'thumbnail': 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c',
            },
            {
                'name': 'Cloud Computing',
                'title': 'Cloud Computing',
                'description': 'Cloud computing is expansive. Learn individual services and concepts through our sub-topics.',
                'category': 'cloud',
                'is_sub_topic': False,
                'thumbnail': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa',
            },
        ]

        # Individual learnable sub-topics
        sub_topics = [
            # ===== AI & Machine Learning Sub-topics =====
            {
                'name': 'Linear Regression',
                'title': 'Linear Regression',
                'description': 'Master linear regression for predicting continuous values. Learn the math behind it, implement it from scratch, and apply it to real-world datasets using scikit-learn.',
                'category': 'ai_ml',
                'difficulty_level': 'beginner',
                'estimated_duration': 90,
                'thumbnail': 'https://images.unsplash.com/photo-1551288049-bebda4e38f71',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'AI & Machine Learning',
                'prerequisites': [],
                'learning_objectives': [
                    'Understand the mathematics of linear regression',
                    'Implement linear regression from scratch',
                    'Use scikit-learn for linear regression',
                    'Evaluate model performance with R² and MSE',
                    'Handle overfitting and underfitting'
                ],
            },
            {
                'name': 'Logistic Regression',
                'title': 'Logistic Regression',
                'description': 'Learn logistic regression for binary and multi-class classification. Understand sigmoid function, decision boundaries, and probability prediction.',
                'category': 'ai_ml',
                'difficulty_level': 'beginner',
                'estimated_duration': 100,
                'thumbnail': 'https://images.unsplash.com/photo-1509228627152-72ae9ae6848d',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'AI & Machine Learning',
                'prerequisites': ['Linear Regression'],
                'learning_objectives': [
                    'Understand logistic regression mathematics',
                    'Apply sigmoid and softmax functions',
                    'Implement binary and multi-class classification',
                    'Evaluate with confusion matrix and ROC curves',
                    'Handle imbalanced datasets'
                ],
            },
            {
                'name': 'Decision Trees',
                'title': 'Decision Trees',
                'description': 'Build decision tree models for classification and regression. Learn entropy, information gain, pruning, and feature importance.',
                'category': 'ai_ml',
                'difficulty_level': 'intermediate',
                'estimated_duration': 110,
                'thumbnail': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'AI & Machine Learning',
                'prerequisites': ['Logistic Regression'],
                'learning_objectives': [
                    'Understand decision tree algorithms',
                    'Calculate entropy and information gain',
                    'Implement tree pruning techniques',
                    'Interpret feature importance',
                    'Avoid overfitting'
                ],
            },
            {
                'name': 'Random Forests',
                'title': 'Random Forests',
                'description': 'Master ensemble learning with random forests. Learn bagging, feature randomness, and how multiple trees create powerful predictions.',
                'category': 'ai_ml',
                'difficulty_level': 'intermediate',
                'estimated_duration': 120,
                'thumbnail': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'AI & Machine Learning',
                'prerequisites': ['Decision Trees'],
                'learning_objectives': [
                    'Understand ensemble learning concepts',
                    'Implement bootstrap aggregating (bagging)',
                    'Use random feature selection',
                    'Tune hyperparameters for optimal performance',
                    'Compare with gradient boosting'
                ],
            },
            {
                'name': 'Neural Networks Fundamentals',
                'title': 'Neural Networks Fundamentals',
                'description': 'Dive into neural networks from scratch. Learn perceptrons, activation functions, backpropagation, and gradient descent.',
                'category': 'ai_ml',
                'difficulty_level': 'intermediate',
                'estimated_duration': 150,
                'thumbnail': 'https://images.unsplash.com/photo-1677442136019-21780ecad995',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'AI & Machine Learning',
                'prerequisites': ['Logistic Regression'],
                'learning_objectives': [
                    'Understand neural network architecture',
                    'Implement forward and backward propagation',
                    'Apply activation functions (ReLU, sigmoid, tanh)',
                    'Use gradient descent optimization',
                    'Build multi-layer perceptrons'
                ],
            },
            {
                'name': 'Convolutional Neural Networks',
                'title': 'Convolutional Neural Networks (CNNs)',
                'description': 'Master CNNs for computer vision tasks. Learn convolution, pooling, filters, and build image classification models.',
                'category': 'ai_ml',
                'difficulty_level': 'advanced',
                'estimated_duration': 180,
                'thumbnail': 'https://images.unsplash.com/photo-1535378917042-10a22c95931a',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'AI & Machine Learning',
                'prerequisites': ['Neural Networks Fundamentals'],
                'learning_objectives': [
                    'Understand convolution operations',
                    'Implement pooling layers',
                    'Design CNN architectures',
                    'Apply transfer learning',
                    'Build image classification systems'
                ],
            },
            {
                'name': 'Recurrent Neural Networks',
                'title': 'Recurrent Neural Networks (RNNs)',
                'description': 'Learn RNNs for sequential data. Master LSTM, GRU, and build models for time series and natural language processing.',
                'category': 'ai_ml',
                'difficulty_level': 'advanced',
                'estimated_duration': 170,
                'thumbnail': 'https://images.unsplash.com/photo-1676277791608-ac5369f37207',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'AI & Machine Learning',
                'prerequisites': ['Neural Networks Fundamentals'],
                'learning_objectives': [
                    'Understand recurrent connections',
                    'Implement LSTM and GRU cells',
                    'Handle vanishing gradients',
                    'Build sequence-to-sequence models',
                    'Apply to NLP and time series'
                ],
            },
            {
                'name': 'K-Means Clustering',
                'title': 'K-Means Clustering',
                'description': 'Master unsupervised learning with K-means. Learn centroid initialization, cluster assignment, and elbow method for optimal K.',
                'category': 'ai_ml',
                'difficulty_level': 'beginner',
                'estimated_duration': 80,
                'thumbnail': 'https://images.unsplash.com/photo-1551288049-bebda4e38f71',
                'is_popular': False,
                'is_sub_topic': True,
                'parent_topic_name': 'AI & Machine Learning',
                'prerequisites': [],
                'learning_objectives': [
                    'Understand clustering concepts',
                    'Implement K-means algorithm',
                    'Use elbow method for K selection',
                    'Evaluate cluster quality',
                    'Apply to customer segmentation'
                ],
            },
            {
                'name': 'Principal Component Analysis',
                'title': 'Principal Component Analysis (PCA)',
                'description': 'Learn dimensionality reduction with PCA. Understand eigenvectors, variance, and feature transformation for better model performance.',
                'category': 'ai_ml',
                'difficulty_level': 'intermediate',
                'estimated_duration': 110,
                'thumbnail': 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5',
                'is_popular': False,
                'is_sub_topic': True,
                'parent_topic_name': 'AI & Machine Learning',
                'prerequisites': ['Linear Regression'],
                'learning_objectives': [
                    'Understand dimensionality reduction',
                    'Calculate eigenvectors and eigenvalues',
                    'Transform features using PCA',
                    'Determine optimal number of components',
                    'Visualize high-dimensional data'
                ],
            },
            {
                'name': 'Support Vector Machines',
                'title': 'Support Vector Machines (SVM)',
                'description': 'Master SVM for classification and regression. Learn about hyperplanes, kernels, margin maximization, and support vectors.',
                'category': 'ai_ml',
                'difficulty_level': 'intermediate',
                'estimated_duration': 130,
                'thumbnail': 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'AI & Machine Learning',
                'prerequisites': ['Logistic Regression'],
                'learning_objectives': [
                    'Understand SVM theory',
                    'Apply kernel trick for non-linear data',
                    'Tune C and gamma parameters',
                    'Handle multi-class classification',
                    'Use SVM for regression tasks'
                ],
            },

            # ===== Web Development Sub-topics =====
            {
                'name': 'HTML5 Fundamentals',
                'title': 'HTML5 Fundamentals',
                'description': 'Master modern HTML5 with semantic elements, forms, multimedia, and accessibility. Build the foundation of web development.',
                'category': 'web_dev',
                'difficulty_level': 'beginner',
                'estimated_duration': 60,
                'thumbnail': 'https://images.unsplash.com/photo-1542831371-29b0f74f9713',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Web Development',
                'prerequisites': [],
                'learning_objectives': [
                    'Use semantic HTML5 elements',
                    'Create accessible forms',
                    'Embed multimedia content',
                    'Implement best practices',
                    'Validate HTML structure'
                ],
            },
            {
                'name': 'CSS3 Styling',
                'title': 'CSS3 Styling and Layout',
                'description': 'Learn modern CSS3 for styling and layouts. Master Flexbox, Grid, animations, and responsive design techniques.',
                'category': 'web_dev',
                'difficulty_level': 'beginner',
                'estimated_duration': 90,
                'thumbnail': 'https://images.unsplash.com/photo-1507721999472-8ed4421c4af2',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Web Development',
                'prerequisites': ['HTML5 Fundamentals'],
                'learning_objectives': [
                    'Style elements with CSS3',
                    'Create layouts with Flexbox and Grid',
                    'Build responsive designs',
                    'Add animations and transitions',
                    'Optimize CSS performance'
                ],
            },
            {
                'name': 'JavaScript ES6+',
                'title': 'JavaScript ES6+ Essentials',
                'description': 'Master modern JavaScript including arrow functions, destructuring, promises, async/await, and modules.',
                'category': 'web_dev',
                'difficulty_level': 'intermediate',
                'estimated_duration': 120,
                'thumbnail': 'https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Web Development',
                'prerequisites': ['HTML5 Fundamentals', 'CSS3 Styling'],
                'learning_objectives': [
                    'Use ES6+ syntax and features',
                    'Understand closures and scope',
                    'Work with promises and async/await',
                    'Implement modules and imports',
                    'Handle errors effectively'
                ],
            },
            {
                'name': 'React Hooks',
                'title': 'React Hooks',
                'description': 'Master React Hooks for functional components. Learn useState, useEffect, useContext, custom hooks, and state management.',
                'category': 'web_dev',
                'difficulty_level': 'intermediate',
                'estimated_duration': 110,
                'thumbnail': 'https://images.unsplash.com/photo-1633356122544-f134324a6cee',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Web Development',
                'prerequisites': ['JavaScript ES6+'],
                'learning_objectives': [
                    'Use useState and useEffect hooks',
                    'Implement useContext for global state',
                    'Create custom hooks',
                    'Optimize with useMemo and useCallback',
                    'Handle side effects properly'
                ],
            },
            {
                'name': 'Node.js REST API',
                'title': 'Building REST APIs with Node.js',
                'description': 'Create RESTful APIs with Node.js and Express. Learn routing, middleware, authentication, and database integration.',
                'category': 'web_dev',
                'difficulty_level': 'intermediate',
                'estimated_duration': 140,
                'thumbnail': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Web Development',
                'prerequisites': ['JavaScript ES6+'],
                'learning_objectives': [
                    'Build RESTful API endpoints',
                    'Implement authentication with JWT',
                    'Use middleware effectively',
                    'Connect to databases',
                    'Handle errors and validation'
                ],
            },
            {
                'name': 'TypeScript Basics',
                'title': 'TypeScript Basics',
                'description': 'Learn TypeScript for type-safe JavaScript. Master interfaces, generics, and integration with modern frameworks.',
                'category': 'web_dev',
                'difficulty_level': 'intermediate',
                'estimated_duration': 100,
                'thumbnail': 'https://images.unsplash.com/photo-1516116216624-53e697fedbea',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Web Development',
                'prerequisites': ['JavaScript ES6+'],
                'learning_objectives': [
                    'Understand TypeScript type system',
                    'Use interfaces and types',
                    'Implement generics',
                    'Configure TypeScript compiler',
                    'Integrate with React/Node.js'
                ],
            },

            # ===== Data Science Sub-topics =====
            {
                'name': 'Python for Data Analysis',
                'title': 'Python for Data Analysis',
                'description': 'Master Python libraries for data analysis: NumPy, Pandas, and data manipulation techniques.',
                'category': 'data_science',
                'difficulty_level': 'beginner',
                'estimated_duration': 100,
                'thumbnail': 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Data Science',
                'prerequisites': [],
                'learning_objectives': [
                    'Use NumPy for numerical computing',
                    'Manipulate data with Pandas',
                    'Clean and transform datasets',
                    'Handle missing values',
                    'Merge and join dataframes'
                ],
            },
            {
                'name': 'Data Visualization with Matplotlib',
                'title': 'Data Visualization with Matplotlib',
                'description': 'Create compelling visualizations with Matplotlib. Learn plots, charts, customization, and storytelling with data.',
                'category': 'data_science',
                'difficulty_level': 'beginner',
                'estimated_duration': 80,
                'thumbnail': 'https://images.unsplash.com/photo-1551288049-bebda4e38f71',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Data Science',
                'prerequisites': ['Python for Data Analysis'],
                'learning_objectives': [
                    'Create line, bar, and scatter plots',
                    'Customize plot aesthetics',
                    'Build subplots and figures',
                    'Save and export visualizations',
                    'Tell stories with data'
                ],
            },
            {
                'name': 'SQL for Data Analysis',
                'title': 'SQL for Data Analysis',
                'description': 'Master SQL queries for data analysis. Learn joins, subqueries, window functions, and complex analytical queries.',
                'category': 'data_science',
                'difficulty_level': 'beginner',
                'estimated_duration': 110,
                'thumbnail': 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Data Science',
                'prerequisites': [],
                'learning_objectives': [
                    'Write complex SQL queries',
                    'Use joins and subqueries',
                    'Apply window functions',
                    'Optimize query performance',
                    'Analyze business data'
                ],
            },
            {
                'name': 'Statistical Analysis',
                'title': 'Statistical Analysis Fundamentals',
                'description': 'Learn core statistical concepts: hypothesis testing, probability distributions, confidence intervals, and p-values.',
                'category': 'data_science',
                'difficulty_level': 'intermediate',
                'estimated_duration': 130,
                'thumbnail': 'https://images.unsplash.com/photo-1543286386-713bdd548da4',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Data Science',
                'prerequisites': ['Python for Data Analysis'],
                'learning_objectives': [
                    'Understand probability distributions',
                    'Perform hypothesis testing',
                    'Calculate confidence intervals',
                    'Interpret p-values correctly',
                    'Apply statistical tests'
                ],
            },
            {
                'name': 'Exploratory Data Analysis',
                'title': 'Exploratory Data Analysis (EDA)',
                'description': 'Master EDA techniques to understand datasets. Learn summary statistics, distributions, correlations, and data profiling.',
                'category': 'data_science',
                'difficulty_level': 'beginner',
                'estimated_duration': 90,
                'thumbnail': 'https://images.unsplash.com/photo-1551288049-bebda4e38f71',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Data Science',
                'prerequisites': ['Python for Data Analysis'],
                'learning_objectives': [
                    'Calculate summary statistics',
                    'Visualize distributions',
                    'Find correlations',
                    'Detect outliers',
                    'Profile datasets effectively'
                ],
            },

            # ===== Mobile Development Sub-topics =====
            {
                'name': 'Swift Basics',
                'title': 'Swift Programming Basics',
                'description': 'Learn Swift fundamentals for iOS development. Master syntax, optionals, protocols, and Swift-specific patterns.',
                'category': 'mobile_dev',
                'difficulty_level': 'beginner',
                'estimated_duration': 100,
                'thumbnail': 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Mobile Development',
                'prerequisites': [],
                'learning_objectives': [
                    'Understand Swift syntax',
                    'Use optionals safely',
                    'Implement protocols',
                    'Work with closures',
                    'Apply value vs reference types'
                ],
            },
            {
                'name': 'Kotlin Fundamentals',
                'title': 'Kotlin Fundamentals',
                'description': 'Master Kotlin for Android development. Learn null safety, coroutines, extension functions, and data classes.',
                'category': 'mobile_dev',
                'difficulty_level': 'beginner',
                'estimated_duration': 110,
                'thumbnail': 'https://images.unsplash.com/photo-1607252650355-f7fd0460ccdb',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Mobile Development',
                'prerequisites': [],
                'learning_objectives': [
                    'Write idiomatic Kotlin code',
                    'Handle null safety',
                    'Use coroutines for async operations',
                    'Create extension functions',
                    'Work with data classes'
                ],
            },
            {
                'name': 'React Native Components',
                'title': 'React Native Components',
                'description': 'Build mobile apps with React Native. Learn core components, navigation, styling, and platform-specific code.',
                'category': 'mobile_dev',
                'difficulty_level': 'intermediate',
                'estimated_duration': 120,
                'thumbnail': 'https://images.unsplash.com/photo-1551650975-87deedd944c3',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Mobile Development',
                'prerequisites': ['JavaScript ES6+'],
                'learning_objectives': [
                    'Use React Native components',
                    'Implement navigation',
                    'Style mobile layouts',
                    'Access native features',
                    'Handle platform differences'
                ],
            },
            {
                'name': 'Flutter Widgets',
                'title': 'Flutter Widgets and Layouts',
                'description': 'Master Flutter widgets for beautiful mobile apps. Learn stateless/stateful widgets, layouts, and Material Design.',
                'category': 'mobile_dev',
                'difficulty_level': 'intermediate',
                'estimated_duration': 130,
                'thumbnail': 'https://images.unsplash.com/photo-1618761714954-0b8cd0026356',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Mobile Development',
                'prerequisites': [],
                'learning_objectives': [
                    'Build with Flutter widgets',
                    'Manage widget state',
                    'Create responsive layouts',
                    'Apply Material Design',
                    'Handle user input'
                ],
            },

            # ===== Cloud Computing Sub-topics =====
            {
                'name': 'AWS EC2 Basics',
                'title': 'AWS EC2 Fundamentals',
                'description': 'Master AWS EC2 for cloud computing. Learn instance types, security groups, storage, and deployment strategies.',
                'category': 'cloud',
                'difficulty_level': 'beginner',
                'estimated_duration': 90,
                'thumbnail': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Cloud Computing',
                'prerequisites': [],
                'learning_objectives': [
                    'Launch and configure EC2 instances',
                    'Choose appropriate instance types',
                    'Set up security groups',
                    'Manage EBS volumes',
                    'Deploy applications'
                ],
            },
            {
                'name': 'Docker Containers',
                'title': 'Docker Containerization',
                'description': 'Learn Docker for containerizing applications. Master Dockerfile, images, containers, volumes, and networking.',
                'category': 'cloud',
                'difficulty_level': 'intermediate',
                'estimated_duration': 110,
                'thumbnail': 'https://images.unsplash.com/photo-1605745341112-85968b19335b',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Cloud Computing',
                'prerequisites': [],
                'learning_objectives': [
                    'Write Dockerfiles',
                    'Build and manage images',
                    'Run containers',
                    'Use volumes for persistence',
                    'Configure networking'
                ],
            },
            {
                'name': 'Kubernetes Basics',
                'title': 'Kubernetes Fundamentals',
                'description': 'Master Kubernetes for container orchestration. Learn pods, deployments, services, and scaling strategies.',
                'category': 'cloud',
                'difficulty_level': 'advanced',
                'estimated_duration': 150,
                'thumbnail': 'https://images.unsplash.com/photo-1605745341112-85968b19335b',
                'is_popular': True,
                'is_sub_topic': True,
                'parent_topic_name': 'Cloud Computing',
                'prerequisites': ['Docker Containers'],
                'learning_objectives': [
                    'Understand Kubernetes architecture',
                    'Deploy applications with pods',
                    'Manage deployments',
                    'Configure services',
                    'Implement auto-scaling'
                ],
            },
            {
                'name': 'AWS S3 Storage',
                'title': 'AWS S3 Storage Solutions',
                'description': 'Master AWS S3 for object storage. Learn buckets, permissions, versioning, lifecycle policies, and static hosting.',
                'category': 'cloud',
                'difficulty_level': 'beginner',
                'estimated_duration': 70,
                'thumbnail': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa',
                'is_popular': False,
                'is_sub_topic': True,
                'parent_topic_name': 'Cloud Computing',
                'prerequisites': [],
                'learning_objectives': [
                    'Create and manage S3 buckets',
                    'Set bucket policies and permissions',
                    'Enable versioning',
                    'Configure lifecycle rules',
                    'Host static websites'
                ],
            },
        ]

        # Create broad topics first
        created_broad = 0
        for topic_data in broad_topics:
            topic, created = Course.objects.get_or_create(
                title=topic_data['title'],
                defaults=topic_data
            )
            if created:
                created_broad += 1
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Created broad topic: {topic.title}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'- Already exists: {topic.title}')
                )

        # Create sub-topics
        created_sub = 0
        for topic_data in sub_topics:
            topic, created = Course.objects.get_or_create(
                title=topic_data['title'],
                defaults=topic_data
            )
            if created:
                created_sub += 1
                self.stdout.write(
                    self.style.SUCCESS(f'  ✓ Created sub-topic: {topic.title}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'  - Already exists: {topic.title}')
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'\n🎉 Successfully seeded:'
                f'\n  - {created_broad} broad topics'
                f'\n  - {created_sub} learnable sub-topics'
                f'\n  - Total: {Course.objects.count()} items in database'
            )
        )
