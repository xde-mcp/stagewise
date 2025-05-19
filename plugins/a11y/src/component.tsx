import {
  PluginBox as Container,
  PluginBoxContent as Content,
  PluginBoxFooter as Footer,
  PluginBoxHeader as Header,
  useEffect,
  useState,
} from '@stagewise/toolbar/plugin-ui';

import { useToolbar } from '@stagewise/toolbar/plugin-ui';
import axe from 'axe-core';

// Define allowed impact levels
type ImpactLevel = 'critical' | 'serious' | 'moderate' | 'minor' | 'unknown';

interface Prompt {
  prompt: string;
  files: [];
  images: [];
}

export const A11yComponent = () => {
  const toolbar = useToolbar();
  const [results, setResults] = useState<axe.AxeResults | null>(null);

  useEffect(() => {
    const clickHandler = async () => {
      try {
        // Configure axe with needed settings
        axe.configure({
          reporter: 'v2',
        });

        // Run the accessibility analysis
        const results = await axe.run(document, {
          resultTypes: ['violations'],
          runOnly: {
            type: 'tag',
            values: [
              'wcag2a',
              'wcag2aa',
              'wcag21a',
              'wcag21aa',
              'best-practice',
            ],
          },
        });

        setResults(results);

        // Log raw results to console for debugging
        console.log('Axe accessibility results:', results);
      } catch (error) {
        console.error('Error running accessibility check:', error);
        alert('Error running accessibility check. See console for details.');
        return { error };
      }
    };

    clickHandler();
  }, [toolbar]);

  return (
    <Container>
      <Header title="Accessibility Checker" />
      <Content>
        <ul>
          {results?.violations.map((violation) => {
            const prompt: Prompt = {
              prompt: `Fix the following accessibility issue: ${violation.description}`,
              files: [],
              images: [],
            };
            return (
              <li key={violation.id}>
                {violation.description}
                <button
                  type="submit"
                  onClick={() => {
                    toolbar.sendPrompt(prompt);
                  }}
                >
                  Fix with AI
                </button>
              </li>
            );
          })}
        </ul>
      </Content>
      <Footer>
        Learn more about accessibility at{' '}
        <a href="https://www.axe-core.org/docs/api-documentation/">
          axe-core.org
        </a>
      </Footer>
    </Container>
  );
};
