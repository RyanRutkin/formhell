export function AboutPage() {
  return (
    <article className="docs-article">
      <h1>About FormHell</h1>
      <p>
        FormHell takes a JSON Schema and turns it into a form, designed to have as little overhead as possible 
        with all the optional capabilites I think you'll need. <br/>We're talking full support for every JSON Schema Draft 2020-12 keyword, 
        full support for deeply nested schemas, asynchronous <code>$ref</code> resolution, actual support for <code>$defs</code>, default 
        generation that actually works tuple arrays (unlike the other libraries), virtualization, localization, theming, 
        built-in widgets for automatically handling every type of JSON Schema field (even a toggle for unions and tuples), 
        and probably something else I forgot to list.
      </p>
      <p>
        And yes, I'm going to keep supporting this project for many years to come. Software's been my love for a long time and I never let my public 
        projects grow stale, especially ones that are being used in enterprise applications (yes, FormHell already is).<br/>Feel free to come collaborate with me on the repo!
      </p>

      <h2>Why FormHell Exists</h2>
      <p>
        FormHell was written because I couldn't keep skirting around the bugs of the "industry-standard" JSON Schema Form libraries with shotty kludges.
        <br/>It doesn't look good on your team when your app keeps breaking due to issues that some library refuses to address (looking at you react-json-schema-forms).
        <br/>I needed a JSON Schema form library that could handle the most complex keywords (if/then, tuple arrays, deep $ref chains, actually generating the right defaults without having to enable "experimental" features ) without breaking.
        <br/>After battling a couple different libraries over the course of two years, I bit the bullet and built my own from scratch.
        <br/>This thing is working great for my team, and it handles those gross schemas designed by my App Dev team and the Design team perfectly.
        <br/>Thankfully all that pain helped me whip up a whole big test suite (with the help of Copilot, because who likes writing tests) to make sure it doesn't fail like all the other libraries did.
      </p>

      <h2>What's with the name?</h2>
      <p>
        Well, the project was originally called "react-autological-forms". 
        <br/>I've been working on another project called Autological for the last 12 years, and I thought "react-af" would be funny. Unfortunately, a "react as f**k" library already exist, there's a few "react-af" libs out there, and there's even a study done called REACT-AF. I couldn't use that because no one would find the library when searching for it. That's why a lot of the CSS classes are still prefixed with "raf-".
      </p>
      <p>
        I spent a couple nights pondering on a new name. I had been working on this library for about five weeks every night 
        and, though I was excited to see it come to life, I was discouraged that I couldn't use the name I wanted. 
        <br/>I was listening to my favorite song <a aria-label="FormHell's theme song" target="_blank" href="https://youtu.be/yHCaH8nxE8U?si=q-C_ZlOaHEop3OVB" rel="noopener noreferrer">"From Hell" by Hellripper</a> on repeat when the name came to me... and now I hear it sung as "FormHell" every time.
        <br/>I guess that's the official theme song for the library. I went back and forth on that name for a bit, but by that point it stuck. 
        <br/>FormHell it is then.
      </p>

      <h2>What FormHell Provides</h2>
      <ul>
        <li>
          <strong>SchemaForm</strong> &mdash; a runtime renderer that supports every core JSON Schema type, resolves
          <code> $ref</code> references (including asynchronous peer schema loading), supports pointer- and
          type-based widget overrides, and emits rich change metadata on every update.
        </li>
        <li>
          <strong>SchemaBuilder</strong> &mdash; a visual schema authoring tool for building object/array
          structures, constraints, composition keywords, and conditional logic, with live validation feedback.
        </li>
        <li>
          <strong>SchemaBuilderHelper</strong> &mdash; a searchable keyword reference so schema authors don&rsquo;t
          need to keep the JSON Schema specification open in another tab.
        </li>
        <li>
          <strong>Virtualization</strong> &mdash; opt-in, dependency-free virtualization for large homogeneous
          arrays, so forms backed by hundreds or thousands of items stay fast without pulling in a separate
          virtualization library.
        </li>
        <li>
          <strong>Localization</strong> &mdash; built-in message overrides or delegation to an existing i18n
          library, without a hard dependency on any specific localization framework.
        </li>
        <li>
          <strong>Theming</strong> &mdash; CSS custom properties with sensible fallbacks, with optional automatic
          Material UI theme consumption when a MUI theme is present.
        </li>
      </ul>

      <h2>Where To Go Next</h2>
      <p>
        Use the navigation on the left to explore each feature in depth. Every page other than this one includes a
        live, interactive example at the top, followed by the full explanation of the feature. The original
        interactive <a href="./playground.html">Playground</a> is still available for freeform schema and data
        experimentation, and is also what backs this project&rsquo;s automated tests.
      </p>
    </article>
  );
}
