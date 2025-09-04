import React, { type FormEvent } from "react";
import Navbar from "~/components/Navbar";
import { useState } from "react";
import Fileupload from "~/components/fileupload";
import { usePuterStore } from "~/lib/puter";
import { convertPdfToImage } from "~/lib/pdf2image";
import { generateUUID } from "~/lib/utils";
import { prepareInstructions } from "../../constants";
import { useNavigate } from "react-router";

const Upload = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("This is a Status Text");
  const [file, setFile] = useState<File | null>(null);
  const { fs, kv, ai } = usePuterStore();
  const navigate = useNavigate();

  const handleFileSelect = (file: File | null) => {
    setFile(file);
  };

  const handleAnalyze = async ({
    company_Name,
    jobTitle,
    jobDescription,
    file,
  }: {
    company_Name: string;
    jobTitle: string;
    jobDescription: string;
    file: File;
  }) => {
    setIsProcessing(true);
    setStatusText("Uploading the File");

    const uploadedFile = await fs.upload([file]);
    console.log("Uploaded File:", uploadedFile);

    if (!uploadedFile)
      return setStatusText("File upload failed. Please try again.");

    setStatusText("Converting to Image");

    const imageFile = await convertPdfToImage(file);
    console.log("Image File Result:", imageFile);

    if (!imageFile.file)
      return setStatusText("Error: Failed to convert PDF to image");

    console.log("Image File :", imageFile.file);

    setStatusText("Uploading the Image...");
    const uploadedImage = await fs.upload([imageFile.file]);
    console.log("Uploading image:", imageFile.file.name);

    if (!uploadedImage) return setStatusText("Error: failed to Upload Image");

    setStatusText("Preparing Data...");
    const uuid = generateUUID();
    console.log("UUID", uuid);
    const data = {
      id: uuid,
      resumePath: uploadedFile.path,
      imagePath: uploadedImage.path,
      company_Name,
      jobTitle,
      jobDescription,
      feedback: "",
    };

    await kv.set(`resume:${uuid}`, JSON.stringify(data));
    setStatusText("Analyzing...");

    const feedback = await ai.feedback(
      uploadedFile.path,
      prepareInstructions({ jobTitle, jobDescription })
    );

    if (!feedback) return setStatusText("Error: Failed to Analyze Resume");
    console.log("Feedback:", feedback);

    const feedbackText =
      typeof feedback.message.content === "string"
        ? feedback.message.content
        : feedback.message.content[0].text;

    console.log("Feedback Text:", feedbackText);

    data.feedback = JSON.parse(feedbackText);
    await kv.set(`resume:${uuid}`, JSON.stringify(data));
    setStatusText("Analysis Complete,redirecting...");
    console.log(data);
    navigate(`/resume/${uuid}`);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget.closest("form");
    if (!form) return;
    const formData = new FormData(form);

    const company_Name = formData.get("company-name") as string;
    const jobTitle = formData.get("job-title") as string;
    const jobDescription = formData.get("job-description") as string;

    if (!file) return;

    handleAnalyze({ company_Name, jobTitle, jobDescription, file });

    console.log({
      company_Name,
      jobTitle,
      jobDescription,
      file,
    });
  };

  return (
    <main className="bg-[url('/images/bg-main.svg')] bg-cover">
      <Navbar />
      <section className="main-section">
        <div className="page-heading py-16">
          <h1 className="w-[80%]">Smart feedback for your dream job</h1>
          {isProcessing ? (
            <>
              <h2>{statusText}</h2>
              <img
                src="/images/resume-scan.gif"
                alt="Resume Scan"
                className="w-full"
              />
            </>
          ) : (
            <>
              <h2>Drop Your Resume for an ATS Score and Improvement Tips</h2>
            </>
          )}

          {!isProcessing && (
            <form
              id="upload-form"
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 mt-8"
            >
              <div className="form-div">
                <label htmlFor="company-name">Company Name</label>
                <input
                  type="text"
                  name="company-name"
                  placeholder="Company Name"
                  id="company-name"
                />
              </div>
              <div className="form-div">
                <label htmlFor="job-title">Job Title</label>
                <input
                  type="text"
                  name="job-title"
                  placeholder="Job Title"
                  id="job-title"
                />
              </div>
              <div className="form-div">
                <label htmlFor="job-description">Job Description</label>
                <textarea
                  rows={5}
                  name="job-description"
                  id="job-description"
                ></textarea>
              </div>

              <div className="form-div">
                <label htmlFor="upload">Upload Resume</label>
                <Fileupload onFileSelect={handleFileSelect} file={file} />
              </div>

              <button className="primary-button" type="submit">
                Analyze Resume
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
};

export default Upload;
