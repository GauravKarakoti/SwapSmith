'use client'
import React from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "What is SwapSmith?",
    answer:
      "SwapSmith is a platform that allows users to swap cryptocurrencies easily, securely, and instantly with industry-grade security."
  },
  {
    question: "How do I create an account?",
    answer:
      "Click on the Register button at the top right and fill in your details. Account creation takes less than a minute."
  },
  {
    question: "Is My data secure?",
    answer:
      "Yes. We use advanced encryption, secure authentication, and best industry practices to protect your data and transactions."
  },
  {
    question: "Which cryptocurrencies are supported?",
    answer:
      "We support a wide range of popular cryptocurrencies including BTC, ETH, USDT, and many more."
  },
  {
    question: "How can I contact support?",
    answer:
      "You can contact our support team through the Contact page or via live chat for instant assistance."
  }
];

const FAQSection: React.FC = () => {
  return (
    <section className="relative py-28 px-6 bg-[#070d1a] text-white overflow-hidden">

      {/* ===== Floating Glow Background Effects ===== */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[160px] animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[160px] animate-pulse"></div>

      <div className="relative max-w-4xl mx-auto">

        {/* ===== Heading ===== */}
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-400 mt-6 text-lg">
            Everything you need to know about SwapSmith
          </p>
        </div>

        {/* ===== FAQ Cards ===== */}
        <div className="space-y-8">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="group relative rounded-3xl p-[1px] 
                         bg-gradient-to-r from-indigo-500/40 via-cyan-500/40 to-violet-500/40
                         hover:from-indigo-500 hover:via-cyan-500 hover:to-violet-500
                         transition-all duration-500"
            >
              <div
                className="backdrop-blur-2xl bg-white/5 border border-white/10 
                           rounded-3xl p-8 transition-all duration-500
                           hover:bg-white/10 hover:shadow-2xl hover:shadow-indigo-500/30"
              >

                {/* Question Row */}
                <div className="flex justify-between items-center">
                  <h3 className="text-xl md:text-2xl font-semibold tracking-wide 
                                 group-hover:text-cyan-400 transition duration-300">
                    {faq.question}
                  </h3>

                  <ChevronDown className="w-6 h-6 text-gray-400 
                                           group-hover:text-cyan-400 
                                           group-hover:rotate-180 
                                           transition-all duration-500" />
                </div>

                {/* Answer */}
                <div
                  className="overflow-hidden max-h-0 opacity-0
                             group-hover:max-h-96 group-hover:opacity-100
                             transition-all duration-500 ease-in-out"
                >
                  <p className="mt-6 text-lg md:text-xl text-gray-100 leading-relaxed font-medium">
                    {faq.answer}
                  </p>
                </div>

              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default FAQSection;
