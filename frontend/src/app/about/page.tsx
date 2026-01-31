import React from 'react';

const AboutPage = () => {
  const teamMembers = [
    { name: 'Sankalp', role: 'Gemini CLI lover', bio: 'striving to work on the next big thing in decentralized energy trading.' },
    { name: 'Akarsh', role: 'The Cheetah', bio: 'the reliable last minute guy who always delivers under pressure.' },
    { name: 'Siddhant', role: 'Cursor Pro Black Dealer', bio: 'sleep doesnt know him, hustling all day and night.' },
  ];

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-primary-DEFAULT tracking-tight">
            We are Los Tecnicos
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg sm:text-xl text-neutral-300">
            A trio of tech enthusiasts on a mission to build awesome things. We're probably fueled by instant noodles and the sheer thrill of hitting 'deploy'.
          </p>
        </div>

        <div className="mt-20">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">Meet the Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-16">
            {teamMembers.map((member) => (
              <div key={member.name} className="bg-neutral-800 p-8 rounded-2xl shadow-lg transform transition-transform duration-300 hover:scale-105 hover:shadow-primary-DEFAULT/20">
                <h3 className="text-2xl font-bold text-primary-DEFAULT">{member.name}</h3>
                <p className="text-md font-semibold text-secondary-DEFAULT mt-1">{member.role}</p>
                <p className="mt-4 text-neutral-400">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-20">
          <h3 className="text-2xl font-bold">Our Philosophy</h3>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-neutral-300">
            "Why did the programmer quit his job? Because he didn't get arrays."
          </p>
          <p className='mt-2 text-neutral-500'>...yeah, we've got more of those.</p>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
