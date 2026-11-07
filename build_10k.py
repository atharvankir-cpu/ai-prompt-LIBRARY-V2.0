import sqlite3
import random

# Database connect karo
conn = sqlite3.connect('aivault.db')
cursor = conn.cursor()

# Table clear karo (taaki purana galat data hat jaye)
cursor.execute("DROP TABLE IF EXISTS prompts")
cursor.execute('''
    CREATE TABLE prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT,
        title TEXT,
        prompt TEXT
    )
''')

# Category to Role Mapping (Sahi expert har category ke liye)
category_experts = {
    "Web Development": "a Senior Full-Stack Web Developer and System Architect",
    "App Development": "a Lead Mobile App Developer (iOS/Android)",
    "Data Science": "a Chief Data Scientist",
    "Machine Learning": "an AI/ML Research Engineer",
    "Artificial Intelligence": "a Senior AI Solutions Architect",
    "Cybersecurity": "a Chief Information Security Officer (CISO)",
    "Cloud Computing": "a Principal Cloud Solutions Architect (AWS/Azure)",
    "Blockchain & Crypto": "a Blockchain Developer and Smart Contract Auditor",
    "Game Development": "a Senior Game Developer and Unreal Engine Expert",
    "UI/UX Design": "a Lead Product Designer and UX Researcher",
    "Digital Marketing": "a Chief Marketing Officer (CMO)",
    "SEO Optimization": "an SEO Specialist and Technical Auditor",
    "Social Media Marketing": "a Viral Social Media Strategist",
    "Email Marketing": "an Email Marketing and Automation Expert",
    "Copywriting": "a World-Class Direct Response Copywriter",
    "E-commerce": "an E-commerce Growth Consultant",
    "Dropshipping": "a 7-Figure Dropshipping Store Owner",
    "Freelancing": "a Top-Rated Upwork Freelancer and Consultant",
    "Agency Building": "a Digital Agency Founder scaling to $1M+",
    "Startup Strategy": "a Y-Combinator Startup Mentor",
    "Personal Finance": "a Certified Financial Planner (CFP)",
    "Stock Market Trading": "a Professional Hedge Fund Trader",
    "Crypto Trading": "a Quantitative Crypto Trader",
    "Real Estate": "a Commercial Real Estate Investor",
    "Financial Analysis": "a Senior Investment Banker",
    "Content Creation": "a Top 1% Content Creator and Influencer",
    "YouTube Growth": "a YouTube Growth Strategist (10M+ subs)",
    "Instagram Growth": "an Instagram Growth Hacker",
    "Creative Writing": "an Award-Winning Novelist",
    "Storytelling": "a Master Hollywood Screenwriter",
    "Bodybuilding": "an IFBB Pro Bodybuilder and Coach",
    "Weight Loss": "a Clinical Weight Loss Specialist",
    "Nutrition": "a Certified Sports Nutritionist",
    "Yoga & Mindfulness": "a Master Yoga Instructor and Mindfulness Coach",
    "Mental Health": "a Licensed Clinical Psychologist",
    "Study Hacks": "a Cognitive Learning Scientist",
    "Language Learning": "a Polyglot and Language Acquisition Expert",
    "Resume & Interview Prep": "a Senior Tech Recruiter at FAANG",
    "Career Growth": "an Executive Career Coach",
    "Exam Preparation": "a Standardized Test Prep Expert",
    "Productivity": "a Productivity Consultant and Author",
    "Time Management": "an Executive Time Management Coach",
    "Habit Building": "a Behavioral Scientist and Habit Expert",
    "Dating & Relationships": "a Professional Relationship Psychologist and Dating Coach",
    "Parenting": "a Pediatrician and Parenting Expert",
    "Travel Planning": "a Luxury Travel Planner",
    "Cooking & Recipes": "a Michelin-Star Executive Chef",
    "Baking": "a Master Pastry Chef",
    "Gardening": "a Master Horticulturist",
    "Pet Care": "a Doctor of Veterinary Medicine (DVM)",
    "Astrology": "a Professional Vedic Astrologer",
    "Tarot Reading": "an Intuitive Tarot Reader",
    "Law & Legal Advice": "a Senior Corporate Lawyer",
    "Medicine & Healthcare": "a Chief Medical Officer",
    "Engineering": "a Chartered Mechanical Engineer",
    "Prompt Engineering": "a Senior AI Prompt Engineer",
    "DevOps": "a Principal DevOps Engineer",
    "QA Testing": "a Senior QA Automation Engineer",
    "Database Management": "a Lead Database Administrator (DBA)",
    "No-Code Development": "a No-Code Automation Expert",
    "Venture Capital": "a Partner at a Top-Tier VC Firm",
    "Sales & Pitching": "a B2B Enterprise Sales Director",
    "Cold Emailing": "a Cold Email Outreach Specialist",
    "Customer Support": "a Director of Customer Experience",
    "Product Management": "a Senior Director of Product Management",
    "Tax Planning": "a Certified Public Accountant (CPA)",
    "Wealth Management": "a Private Wealth Manager",
    "DeFi": "a DeFi Protocol Architect",
    "NFT Creation": "a Web3 Artist and NFT Creator",
    "E-commerce Finance": "a CFO for E-commerce Brands",
    "Screenwriting": "a Hollywood Screenwriter",
    "Video Editing": "a Master Video Editor and Colorist",
    "Photography": "an Award-Winning Commercial Photographer",
    "Music Production": "a Grammy-Winning Music Producer",
    "Graphic Design": "a Senior Brand Identity Designer",
    "Interior Design": "a Luxury Interior Designer",
    "Fashion Design": "a High-End Fashion Designer",
    "Architecture": "a Pritzker Prize-Winning Architect",
    "Blogging": "a Six-Figure Professional Blogger",
    "Podcasting": "a Top 100 Podcast Host",
    "Sleep Optimization": "a Sleep Medicine Physician",
    "Biohacking": "a Human Performance Biohacker",
    "Sports Analytics": "a Sports Data Scientist",
    "Martial Arts": "a Black Belt Martial Arts Master",
    "Physical Therapy": "a Doctor of Physical Therapy (DPT)",
    "Research Writing": "a Senior Academic Researcher",
    "Math Tutoring": "a University Mathematics Professor",
    "Science Tutoring": "a Senior Physics Professor",
    "History & Civics": "a Tenured History Professor",
    "Competitive Programming": "a Grandmaster Competitive Programmer",
    "DIY Crafts": "a Master DIY Crafter",
    "Home Improvement": "a Licensed General Contractor",
    "Car Maintenance": "a Master Automotive Mechanic",
    "Personal Branding": "a Personal Branding Strategist",
    "Negotiation Skills": "a FBI Hostage Negotiator",
    "Game Strategy": "a Professional Esports Strategist",
    "Esports Coaching": "a Head Esports Coach",
    "Streaming": "a Top Twitch Streamer",
    "Game Design": "a Senior Game Designer",
    "Virtual Reality": "a VR/AR Developer"
}

# Actions
actions = [
    "create a comprehensive strategy for",
    "analyze and optimize my approach to",
    "provide a step-by-step masterclass on",
    "build a robust framework for",
    "generate a highly detailed roadmap for",
    "audit and improve my current system for",
    "write an in-depth guide about"
]

# Prompt generate karne ka function (300+ words simulate karne ke liye)
def generate_long_prompt(category, role, action):
    base_prompt = f"Act as {role}. Your task is to {action} [Insert Your Specific Topic/Goal Here] within the realm of {category}. \n\n"
    
    filler = """
    Begin by asking me 5 highly specific questions about my current situation, goals, and constraints so you can tailor your advice perfectly to my needs. 
    Once I provide the context, generate a comprehensive report structured into the following sections:
    1. Executive Summary: A brief overview of the core strategy.
    2. Deep-Dive Analysis: Detailed insights into best practices, common pitfalls, and market trends within this domain.
    3. Step-by-Step Implementation Guide: Exactly what actions I need to take daily, weekly, and monthly.
    4. Tools & Resources: A curated list of software, frameworks, or methodologies I should use.
    5. KPIs & Metrics: How I should measure success and track my progress.
    6. Advanced Tactics: Pro-level strategies that top 1% of performers use.
    7. Risk Management: Potential obstacles and how to mitigate them.

    Provide highly actionable, specific, and data-driven recommendations. Use professional terminology but explain complex concepts clearly. Do not give generic advice. Every recommendation must be tailored to the specific nuances of the category. 
    
    Conclude the report by highlighting the top 3 most critical actions I must take immediately within the next 48 hours to achieve rapid results.
    """
    
    return base_prompt + filler

print("🚀 Regenerating 10,000 Premium Prompts with correct roles... (Wait 1-2 minutes)")

count = 0
for cat in category_experts.keys():
    # 100 prompts per category
    for i in range(1, 101):
        role = category_experts[cat]
        action = random.choice(actions)
        
        title = f"Masterclass: {cat} Strategy {i}"
        prompt_text = generate_long_prompt(cat, role, action)
        
        cursor.execute("INSERT INTO prompts (category, title, prompt) VALUES (?, ?, ?)", (cat, title, prompt_text))
        count += 1

conn.commit()
conn.close()

print(f"✅ Success! {count} Prompts inserted with 100% accurate roles.")
print("Ab tu 'python app.py' chala ke website check kar sakta hai!")