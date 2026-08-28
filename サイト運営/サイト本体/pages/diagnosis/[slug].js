import Layout from "../../components/Layout";
import DiagnosisQuiz from "../../components/DiagnosisQuiz";
import { getAllMajorCategories } from "../../lib/posts";
import { getDiagnosisSlugs, getDiagnosis } from "../../lib/diagnosisTopics";

// lib/diagnosisTopics.js に診断を登録した分だけページを生成する。
// 未登録(0件)の間は静的パスが空になり、/diagnosis 配下は公開されない。
export async function getStaticPaths() {
  return {
    paths: getDiagnosisSlugs().map((slug) => ({ params: { slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const diagnosis = getDiagnosis(params.slug);
  if (!diagnosis) return { notFound: true };
  return {
    props: {
      slug: params.slug,
      diagnosis,
      categories: getAllMajorCategories(),
    },
  };
}

export default function DiagnosisPage({ slug, diagnosis, categories }) {
  return (
    <Layout
      title={diagnosis.title}
      description={diagnosis.description}
      categories={categories}
      canonicalPath={`/diagnosis/${slug}`}
      panel
    >
      <h1 className="page-title">{diagnosis.heading}</h1>
      {diagnosis.note && <p className="page-note">{diagnosis.note}</p>}
      <DiagnosisQuiz
        questions={diagnosis.questions}
        results={diagnosis.results}
        defaultType={diagnosis.defaultType}
        disclaimer={diagnosis.disclaimer}
      />
    </Layout>
  );
}
